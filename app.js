// ESTADO GLOBAL
let state = {
  liveCategories: [], movieCategories: [], seriesCategories: [],
  liveStreams: [], movieStreams: [], seriesStreams: [],
  activeType: 'live', activeCategory: 'ALL'
};

let hlsPlayer = null;

// GENERAR MAC Y DEVICE KEY
function initDispositivo() {
  let mac = localStorage.getItem('ds_mac');
  let key = localStorage.getItem('ds_key');
  
  if (!mac || !key) {
    const hex = '0123456789ABCDEF';
    mac = '00:1A:79:' + Array.from({length: 3}, () => hex[Math.floor(Math.random()*16)] + hex[Math.floor(Math.random()*16)]).join(':');
    key = Math.floor(100000 + Math.random() * 900000).toString(); // PIN de 6 dígitos
    localStorage.setItem('ds_mac', mac);
    localStorage.setItem('ds_key', key);
  }
  
  document.getElementById('deviceMacDisplay').innerText = mac;
  document.getElementById('deviceKeyDisplay').innerText = key;
  document.getElementById('macFooter').innerText = `MAC: ${mac}`;
}

document.addEventListener('DOMContentLoaded', initDispositivo);

// CAMBIAR PESTAÑAS LOGIN
function cambiarMetodo(metodo) {
  document.querySelectorAll('.form-section').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  
  document.getElementById('tab' + metodo.charAt(0).toUpperCase() + metodo.slice(1)).classList.add('active');
  document.getElementById('form' + metodo.charAt(0).toUpperCase() + metodo.slice(1)).classList.remove('hidden');
}

// FETCH CON BYPASS PARA EVITAR BLOQUEOS (CORS)
async function fetchSeguro(targetUrl) {
  try {
    // Usamos allorigins como proxy puente para evitar el bloqueo del navegador
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error('Fallo el proxy');
    return res;
  } catch (e) {
    // Fallback directo
    return fetch(targetUrl);
  }
}

// SIMULACIÓN DE ACTIVACIÓN REMOTA (Para tu panel)
function verificarActivacionRemota() {
  const errorBox = document.getElementById('errorMessage');
  errorBox.classList.remove('hidden');
  errorBox.style.color = '#fbbf24';
  errorBox.style.borderColor = '#f59e0b';
  errorBox.style.backgroundColor = 'rgba(245, 158, 11, 0.2)';
  errorBox.innerText = 'Verificando con el servidor de Don Streaming... (Base de datos remota requerida para esta función)';
  
  // Aquí en el futuro conectaremos Firebase para que al hundir este botón, 
  // descargue la lista que tú le asignaste a esa MAC desde tu PC.
}

// LOGIN M3U (ARREGLADO)
async function iniciarSesionM3u(e) {
  e.preventDefault();
  const url = document.getElementById('m3uUrl').value.trim();
  const errorBox = document.getElementById('errorMessage');
  errorBox.classList.add('hidden');

  try {
    const response = await fetchSeguro(url);
    const text = await response.text();
    const parsed = parseM3U(text);
    
    if (parsed.channels.length === 0) throw new Error('No se encontraron canales.');

    state.liveStreams = parsed.channels;
    state.liveCategories = parsed.categories;
    mostrarDashboard('Usuario M3U');
  } catch (err) {
    errorBox.innerText = 'Error al cargar lista. Verifica la URL o intenta con Xtream.';
    errorBox.classList.remove('hidden');
  }
}

// LOGIN XTREAM
async function iniciarSesionXtream(e) {
  e.preventDefault();
  let server = document.getElementById('serverUrl').value.trim().replace(/\/+$/, "");
  const user = document.getElementById('username').value.trim();
  const pass = document.getElementById('password').value.trim();
  const errorBox = document.getElementById('errorMessage');
  errorBox.classList.add('hidden');

  if (!server.startsWith('http')) server = 'http://' + server;

  try {
    // Si falla la API compleja, intentamos cargarla como M3U clásico
    const m3uUrl = `${server}/get.php?username=${user}&password=${pass}&type=m3u_plus`;
    const response = await fetchSeguro(m3uUrl);
    const text = await response.text();
    
    const parsed = parseM3U(text);
    if (parsed.channels.length === 0) throw new Error('Credenciales inválidas o servidor caído.');

    state.liveStreams = parsed.channels;
    state.liveCategories = parsed.categories;
    mostrarDashboard(user);
  } catch (err) {
    errorBox.innerText = 'Error de conexión. Revisa el Servidor, Usuario y Contraseña.';
    errorBox.classList.remove('hidden');
  }
}

// PARSER M3U REPARADO Y FLEXIBLE
function parseM3U(m3uText) {
  const lines = m3uText.split(/\r?\n/);
  const channels = [];
  const categoriesMap = {};
  let lastExt = null;

  lines.forEach(line => {
    line = line.trim();
    if (line.startsWith('#EXTINF:')) {
      lastExt = line;
    } else if (line.startsWith('http')) {
      let name = 'Canal Desconocido';
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

// MOSTRAR INTERFAZ
function mostrarDashboard(usuario) {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appContainer').classList.remove('hidden');
  document.getElementById('userLogged').innerText = `Usuario: ${usuario}`;
  
  document.getElementById('countLive').innerText = `${state.liveStreams.length} Canales`;
  document.getElementById('countMovies').innerText = `0 Películas`;
  document.getElementById('countSeries').innerText = `0 Series`;
}

// ABRIR SECCIÓN (TV, MOVIES, SERIES)
function abrirSeccion(tipo) {
  state.activeType = tipo;
  state.activeCategory = 'ALL';

  document.getElementById('appContainer').classList.add('hidden');
  document.getElementById('playerView').classList.remove('hidden');

  let cats = [];
  if (tipo === 'live') {
    document.getElementById('sectionTitle').innerText = '📺 TV en Vivo';
    cats = state.liveCategories;
  }

  const catSelect = document.getElementById('categorySelect');
  catSelect.innerHTML = '<option value="ALL">Todas las Categorías</option>';
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

function renderizarLista() {
  const container = document.getElementById('channelList');
  container.innerHTML = '';

  let items = state.liveStreams; // Por ahora todo va a liveStreams con el M3U
  if (state.activeCategory !== 'ALL') {
    items = items.filter(i => i.category_id === state.activeCategory);
  }

  const query = document.getElementById('searchInput').value.toLowerCase();
  if (query) {
    items = items.filter(i => i.name.toLowerCase().includes(query));
  }

  items.slice(0, 150).forEach(item => {
    const div = document.createElement('div');
    div.className = 'channel-item';
    div.innerHTML = `<span class="channel-icon">▶️</span><span class="channel-name">${item.name}</span>`;
    div.onclick = () => reproducirItem(item, div);
    container.appendChild(div);
  });
}

// REPRODUCTOR HLS
function reproducirItem(item, elemento) {
  document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
  if (elemento) elemento.classList.add('active');

  document.getElementById('currentChannelTitle').innerText = item.name;
  const video = document.getElementById('mainVideoPlayer');
  
  // Usamos el proxy directo también para el stream si es necesario, o la URL directa
  const streamUrl = item.url;

  if (hlsPlayer) hlsPlayer.destroy();

  if (Hls.isSupported()) {
    hlsPlayer = new Hls();
    hlsPlayer.loadSource(streamUrl);
    hlsPlayer.attachMedia(video);
    hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(()=>{}));
  } else {
    video.src = streamUrl;
    video.play().catch(()=>{});
  }
}

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
