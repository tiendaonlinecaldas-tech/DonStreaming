// ESTADO GLOBAL DE APLICACIÓN
let state = {
  server: '',
  user: '',
  pass: '',
  m3uUrl: '',
  mode: 'xtream', // 'xtream' | 'm3u'
  liveCategories: [],
  movieCategories: [],
  seriesCategories: [],
  liveStreams: [],
  movieStreams: [],
  seriesStreams: [],
  activeType: 'live', // 'live' | 'movies' | 'series'
  activeCategory: 'ALL'
};

let hlsPlayer = null;

// GENERADOR DE DIRECCIÓN MAC VIRTUAL ÚNICA POR NAVEGADOR
function obtenerOcrearMAC() {
  let mac = localStorage.getItem('donstreaming_mac');
  if (!mac) {
    const hexDigits = '0123456789ABCDEF';
    let generated = '00:1A:79:';
    for (let i = 0; i < 3; i++) {
      generated += hexDigits[Math.floor(Math.random() * 16)];
      generated += hexDigits[Math.floor(Math.random() * 16)];
      if (i < 2) generated += ':';
    }
    mac = generated;
    localStorage.setItem('donstreaming_mac', mac);
  }
  return mac;
}

// INICIALIZAR PANTALLA
document.addEventListener('DOMContentLoaded', () => {
  const mac = obtenerOcrearMAC();
  document.getElementById('deviceMacDisplay').innerText = mac;
  document.getElementById('macFooter').innerText = `MAC: ${mac}`;
});

// PESTAÑAS LOGIN
function cambiarMetodo(metodo) {
  state.mode = metodo;
  document.getElementById('formXtream').classList.toggle('hidden', metodo !== 'xtream');
  document.getElementById('formM3u').classList.toggle('hidden', metodo !== 'm3u');
  document.getElementById('tabXtream').classList.toggle('active', metodo === 'xtream');
  document.getElementById('tabM3u').classList.toggle('active', metodo === 'm3u');
}

// LOGIN VIA XTREAM CODES (API CATEGORIZADA)
function iniciarSesionXtream(e) {
  e.preventDefault();
  let server = document.getElementById('serverUrl').value.trim();
  const user = document.getElementById('username').value.trim();
  const pass = document.getElementById('password').value.trim();

  if (!server.startsWith('http://') && !server.startsWith('https://')) {
    server = 'http://' + server;
  }
  server = server.replace(/\/+$/, "");

  state.server = server;
  state.user = user;
  state.pass = pass;

  const apiUrl = `${server}/player_api.php?username=${user}&password=${pass}`;

  fetchProxy(apiUrl)
    .then(res => res.json())
    .then(data => {
      if (data.user_info && data.user_info.auth === 0) {
        throw new Error('Usuario o Contraseña incorrectos.');
      }
      return cargarCategoriasYContenido(server, user, pass);
    })
    .then(() => {
      mostrarDashboard(user);
    })
    .catch(err => {
      // Fallback si la API de Xtream viene protegida
      const m3uUrl = `${server}/get.php?username=${user}&password=${pass}&type=m3u_plus`;
      cargarDesdeM3U(m3uUrl, user);
    });
}

// LOGIN VIA LISTA M3U
function iniciarSesionM3u(e) {
  e.preventDefault();
  const url = document.getElementById('m3uUrl').value.trim();
  state.m3uUrl = url;
  cargarDesdeM3U(url, 'Usuario M3U');
}

// PETICIÓN ATRAVÉS DEL PROXY DE VERCEL
function fetchProxy(targetUrl) {
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
  return fetch(proxyUrl).then(r => {
    if (!r.ok) throw new Error('Error al conectar con el servidor proxy');
    return r;
  });
}

// CARGA DE CATEGORÍAS XTREAM
async function cargarCategoriasYContenido(server, user, pass) {
  const base = `${server}/player_api.php?username=${user}&password=${pass}`;

  const [resLiveCats, resMovieCats, resSeriesCats, resLiveStreams, resMovieStreams, resSeriesStreams] = await Promise.all([
    fetchProxy(`${base}&action=get_live_categories`).then(r => r.json()).catch(() => []),
    fetchProxy(`${base}&action=get_vod_categories`).then(r => r.json()).catch(() => []),
    fetchProxy(`${base}&action=get_series_categories`).then(r => r.json()).catch(() => []),
    fetchProxy(`${base}&action=get_live_streams`).then(r => r.json()).catch(() => []),
    fetchProxy(`${base}&action=get_vod_streams`).then(r => r.json()).catch(() => []),
    fetchProxy(`${base}&action=get_series`).then(r => r.json()).catch(() => [])
  ]);

  state.liveCategories = resLiveCats || [];
  state.movieCategories = resMovieCats || [];
  state.seriesCategories = resSeriesCats || [];

  state.liveStreams = (resLiveStreams || []).map(s => ({
    id: s.stream_id,
    name: s.name,
    category_id: s.category_id,
    url: `${server}/live/${user}/${pass}/${s.stream_id}.m3u8`
  }));

  state.movieStreams = (resMovieStreams || []).map(s => ({
    id: s.stream_id,
    name: s.name,
    category_id: s.category_id,
    url: `${server}/movie/${user}/${pass}/${s.stream_id}.${s.container_extension || 'mp4'}`
  }));

  state.seriesStreams = (resSeriesStreams || []).map(s => ({
    id: s.series_id,
    name: s.name,
    category_id: s.category_id,
    url: `${server}/series/${user}/${pass}/${s.series_id}.mp4`
  }));
}

// CARGA PARSEADA PARA LISTA M3U DIRECTA
function cargarDesdeM3U(url, usuario) {
  fetchProxy(url)
    .then(r => r.text())
    .then(text => {
      const parsed = parseM3U(text);
      if (parsed.channels.length === 0) throw new Error('No se encontraron canales en la lista.');

      state.liveStreams = parsed.channels;
      state.liveCategories = parsed.categories;
      mostrarDashboard(usuario);
    })
    .catch(err => {
      const errorBox = document.getElementById('errorMessage');
      errorBox.innerText = err.message || 'Error al conectar con la lista.';
      errorBox.classList.remove('hidden');
    });
}

function parseM3U(m3uText) {
  const lines = m3uText.split(/\r?\n/);
  const channels = [];
  const categoriesMap = {};
  let lastExt = null;

  lines.forEach(line => {
    line = line.trim();
    if (line.startsWith('#EXTINF:')) {
      lastExt = line;
    } else if (line.startsWith('http://') || line.startsWith('https://')) {
      let name = 'Canal';
      let cat = 'General';

      if (lastExt) {
        const cIdx = lastExt.lastIndexOf(',');
        if (cIdx !== -1) name = lastExt.substring(cIdx + 1).trim();
        const gMatch = lastExt.match(/group-title="([^"]+)"/i);
        if (gMatch) cat = gMatch[1].trim();
      }

      categoriesMap[cat] = cat;
      channels.push({ name, category_id: cat, url: line });
      lastExt = null;
    }
  });

  const categories = Object.keys(categoriesMap).map(c => ({ category_id: c, category_name: c }));
  return { channels, categories };
}

// MOSTRAR PANTALLAS
function mostrarDashboard(usuario) {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appContainer').classList.remove('hidden');
  document.getElementById('userLogged').innerText = `Logged in : ${usuario}`;

  document.getElementById('countLive').innerText = `${state.liveStreams.length} Contenidos`;
  document.getElementById('countMovies').innerText = `${state.movieStreams.length} Contenidos`;
  document.getElementById('countSeries').innerText = `${state.seriesStreams.length} Contenidos`;
}

// ABRIR VISTA REPRODUCTOR
function abrirSeccion(tipo) {
  state.activeType = tipo;
  state.activeCategory = 'ALL';

  document.getElementById('appContainer').classList.add('hidden');
  document.getElementById('playerView').classList.remove('hidden');

  const titleElem = document.getElementById('sectionTitle');
  let cats = [];

  if (tipo === 'live') {
    titleElem.innerText = '📺 Televisión en Vivo';
    cats = state.liveCategories;
  } else if (tipo === 'movies') {
    titleElem.innerText = '🎬 Películas';
    cats = state.movieCategories;
  } else {
    titleElem.innerText = '🎞️ Series';
    cats = state.seriesCategories;
  }

  // Llenar selector de categorías
  const catSelect = document.getElementById('categorySelect');
  catSelect.innerHTML = '<option value="ALL">-- Todas las Categorías --</option>';

  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.category_id;
    opt.innerText = c.category_name;
    catSelect.appendChild(opt);
  });

  renderizarLista();
}

function seleccionarCategoria(catId) {
  state.activeCategory = catId;
  renderizarLista();
}

function obtenerStreamsActivos() {
  if (state.activeType === 'live') return state.liveStreams;
  if (state.activeType === 'movies') return state.movieStreams;
  return state.seriesStreams;
}

function renderizarLista() {
  const container = document.getElementById('channelList');
  container.innerHTML = '';

  let items = obtenerStreamsActivos();

  if (state.activeCategory !== 'ALL') {
    items = items.filter(i => String(i.category_id) === String(state.activeCategory));
  }

  const query = document.getElementById('searchInput').value.toLowerCase();
  if (query) {
    items = items.filter(i => i.name.toLowerCase().includes(query));
  }

  if (items.length === 0) {
    container.innerHTML = '<p class="loading-text">No hay elementos disponibles en esta categoría.</p>';
    return;
  }

  // Renderizar máximo 200 por rendimiento
  items.slice(0, 200).forEach(item => {
    const div = document.createElement('div');
    div.className = 'channel-item';
    div.innerHTML = `
      <span class="channel-icon">${state.activeType === 'live' ? '📺' : '🎬'}</span>
      <span class="channel-name">${item.name}</span>
    `;
    div.onclick = () => reproducirItem(item, div);
    container.appendChild(div);
  });
}

function filtrarContenido() {
  renderizarLista();
}

// REPRODUCTOR HLS / STREAMING
function reproducirItem(item, elemento) {
  document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
  if (elemento) elemento.classList.add('active');

  document.getElementById('currentChannelTitle').innerText = `Reproduciendo: ${item.name}`;

  const video = document.getElementById('mainVideoPlayer');
  const streamProxyUrl = `/api/proxy?url=${encodeURIComponent(item.url)}`;

  if (hlsPlayer) hlsPlayer.destroy();

  if (Hls.isSupported()) {
    hlsPlayer = new Hls({ enableWorker: true, lowLatencyMode: true });
    hlsPlayer.loadSource(streamProxyUrl);
    hlsPlayer.attachMedia(video);
    hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = streamProxyUrl;
    video.play().catch(() => {});
  } else {
    video.src = streamProxyUrl;
    video.play().catch(() => {});
  }
}

// NAVEGACIÓN Y RELOJ
function volverAlMenu() {
  const video = document.getElementById('mainVideoPlayer');
  video.pause();
  if (hlsPlayer) hlsPlayer.destroy();

  document.getElementById('playerView').classList.add('hidden');
  document.getElementById('appContainer').classList.remove('hidden');
}

function cerrarSesion() {
  volverAlMenu();
  document.getElementById('appContainer').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}

setInterval(() => {
  const clock = document.getElementById('clockDisplay');
  if (clock) {
    clock.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}, 1000);
