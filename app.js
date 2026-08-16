// VARIABLES GLOBALES DE SESIÓN
let session = {
  type: null,
  server: '',
  user: '',
  pass: '',
  m3uUrl: '',
  channels: []
};

let hlsPlayer = null;

// PESTAÑAS LOGIN
function cambiarMetodo(metodo) {
  const formXtream = document.getElementById('formXtream');
  const formM3u = document.getElementById('formM3u');
  const tabXtream = document.getElementById('tabXtream');
  const tabM3u = document.getElementById('tabM3u');

  if (metodo === 'xtream') {
    formXtream.classList.remove('hidden');
    formM3u.classList.add('hidden');
    tabXtream.classList.add('active');
    tabM3u.classList.remove('active');
  } else {
    formXtream.classList.add('hidden');
    formM3u.classList.remove('hidden');
    tabXtream.classList.remove('active');
    tabM3u.classList.add('active');
  }
}

// INICIO SESIÓN XTREAM
function iniciarSesionXtream(e) {
  e.preventDefault();
  let server = document.getElementById('serverUrl').value.trim();
  const user = document.getElementById('username').value.trim();
  const pass = document.getElementById('password').value.trim();

  if (!server.startsWith('http://') && !server.startsWith('https://')) {
    server = 'http://' + server;
  }

  session.type = 'xtream';
  session.server = server;
  session.user = user;
  session.pass = pass;

  // Construir URL M3U derivada de los datos Xtream
  session.m3uUrl = `${server}/get.php?username=${user}&password=${pass}&type=m3u_plus`;

  cargarListaIPTV(session.m3uUrl, user);
}

// INICIO SESIÓN M3U
function iniciarSesionM3u(e) {
  e.preventDefault();
  const url = document.getElementById('m3uUrl').value.trim();

  session.type = 'm3u';
  session.m3uUrl = url;

  cargarListaIPTV(url, 'Usuario M3U');
}

// CARGA Y PARSEO DE LA LISTA DE CANALES
function cargarListaIPTV(url, usuario) {
  const errorBox = document.getElementById('errorMessage');
  errorBox.classList.add('hidden');

  const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;

  fetch(proxyUrl)
    .then(res => {
      if (!res.ok) throw new Error('No se pudo conectar a la lista IPTV.');
      return res.text();
    })
    .then(textData => {
      session.channels = parseM3U(textData);

      if (session.channels.length === 0) {
        throw new Error('La lista no contiene canales reproducibles.');
      }

      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('appContainer').classList.remove('hidden');
      document.getElementById('userLogged').innerText = `Logged in : ${usuario}`;
    })
    .catch(err => {
      errorBox.innerText = err.message || 'Error al conectar. Verifica tus datos.';
      errorBox.classList.remove('hidden');
    });
}

// PARSEADOR DE CONTENIDO M3U
function parseM3U(m3uText) {
  const lines = m3uText.split('\n');
  const channels = [];
  let currentChannel = {};

  lines.forEach(line => {
    line = line.trim();
    if (line.startsWith('#EXTINF:')) {
      const titleMatch = line.match(/,(.+)$/);
      const groupMatch = line.match(/group-title="([^"]+)"/);
      
      currentChannel = {
        name: titleMatch ? titleMatch[1].trim() : 'Canal Sin Nombre',
        category: groupMatch ? groupMatch[1].trim() : 'General'
      };
    } else if (line.startsWith('http://') || line.startsWith('https://')) {
      currentChannel.url = line;
      channels.push(currentChannel);
      currentChannel = {};
    }
  });

  return channels;
}

// ABRIR SECCIONES (LIVE TV / MOVIES / SERIES)
function abrirSeccion(tipo) {
  document.getElementById('appContainer').classList.add('hidden');
  document.getElementById('playerView').classList.remove('hidden');

  const titleElem = document.getElementById('sectionTitle');
  if (tipo === 'live') titleElem.innerText = '📺 Televisión en Vivo';
  if (tipo === 'movies') titleElem.innerText = '🎬 Películas';
  if (tipo === 'series') titleElem.innerText = '🎞️ Series';

  renderizarCanales(session.channels);
}

// RENDERIZAR LISTA EN EL SIDEBAR
function renderizarCanales(lista) {
  const listContainer = document.getElementById('channelList');
  listContainer.innerHTML = '';

  if (lista.length === 0) {
    listContainer.innerHTML = '<p class="loading-text">No se encontraron canales.</p>';
    return;
  }

  lista.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'channel-item';
    div.innerHTML = `
      <span class="channel-icon">📺</span>
      <span class="channel-name">${item.name}</span>
    `;
    div.onclick = () => reproducirCanal(item, div);
    listContainer.appendChild(div);
  });
}

// BUSCADOR EN TIEMPO REAL
function filtrarCanales() {
  const query = document.getElementById('searchInput').value.toLowerCase();
  const filtrados = session.channels.filter(c => c.name.toLowerCase().includes(query));
  renderizarCanales(filtrados);
}

// REPRODUCCIÓN DE VIDEO CON HLS.JS
function reproducirCanal(canal, elementoHtml) {
  document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
  if (elementoHtml) elementoHtml.classList.add('active');

  document.getElementById('currentChannelTitle').innerText = `Reproduciendo: ${canal.name}`;

  const video = document.getElementById('mainVideoPlayer');
  const streamProxyUrl = `/api/proxy?url=${encodeURIComponent(canal.url)}`;

  if (hlsPlayer) {
    hlsPlayer.destroy();
  }

  if (Hls.isSupported()) {
    hlsPlayer = new Hls({
      enableWorker: true,
      lowLatencyMode: true
    });
    hlsPlayer.loadSource(streamProxyUrl);
    hlsPlayer.attachMedia(video);
    hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {});
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = streamProxyUrl;
    video.play().catch(() => {});
  } else {
    video.src = streamProxyUrl;
    video.play().catch(() => {});
  }
}

// NAVEGACIÓN Y CERRAR SESIÓN
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

// RELOJ DENTRO DEL DASHBOARD
setInterval(() => {
  const clock = document.getElementById('clockDisplay');
  if (clock) {
    clock.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}, 1000);
