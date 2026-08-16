// VARIABLES GLOBALES DE SESIÓN
let session = {
  server: '',
  user: '',
  pass: '',
  m3uUrl: '',
  channels: []
};

let hlsPlayer = null;

// INICIO DE SESIÓN CON USUARIO, CONTRASEÑA Y URL
function iniciarSesion(e) {
  e.preventDefault();
  
  let server = document.getElementById('serverUrl').value.trim();
  const user = document.getElementById('username').value.trim();
  const pass = document.getElementById('password').value.trim();

  // Asegurar formato HTTP/HTTPS
  if (!server.startsWith('http://') && !server.startsWith('https://')) {
    server = 'http://' + server;
  }

  // Eliminar barras diagonales al final si existen
  server = server.replace(/\/+$/, "");

  session.server = server;
  session.user = user;
  session.pass = pass;

  // Construir automáticamente la lista M3U
  session.m3uUrl = `${server}/get.php?username=${user}&password=${pass}&type=m3u_plus`;

  cargarListaIPTV(session.m3uUrl, user);
}

// CARGA Y PROCESAMIENTO DE LA LISTA
function cargarListaIPTV(url, usuario) {
  const errorBox = document.getElementById('errorMessage');
  errorBox.classList.add('hidden');

  const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;

  fetch(proxyUrl)
    .then(res => {
      if (!res.ok) throw new Error('No se pudo conectar al servidor IPTV.');
      return res.text();
    })
    .then(textData => {
      session.channels = parseM3UFlex(textData);

      if (session.channels.length === 0) {
        throw new Error('Las credenciales o la URL no devolvieron canales válidos.');
      }

      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('appContainer').classList.remove('hidden');
      document.getElementById('userLogged').innerText = `Logged in : ${usuario}`;
    })
    .catch(err => {
      errorBox.innerText = err.message || 'Error de conexión. Revisa URL, Usuario o Contraseña.';
      errorBox.classList.remove('hidden');
    });
}

// PARSEADOR M3U FLEXIBLE
function parseM3UFlex(m3uText) {
  const lines = m3uText.split(/\r?\n/);
  const channels = [];
  let lastExtInf = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      lastExtInf = line;
    } else if (line.startsWith('http://') || line.startsWith('https://') || line.includes('://')) {
      let name = 'Canal ' + (channels.length + 1);
      let category = 'General';

      if (lastExtInf) {
        const commaIdx = lastExtInf.lastIndexOf(',');
        if (commaIdx !== -1) {
          name = lastExtInf.substring(commaIdx + 1).trim() || name;
        }
        const groupMatch = lastExtInf.match(/group-title="([^"]+)"/i);
        if (groupMatch) {
          category = groupMatch[1].trim();
        }
      }

      channels.push({
        name: name,
        category: category,
        url: line
      });

      lastExtInf = null;
    }
  }

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

// RENDERIZAR CANALES EN LISTA LATERAL
function renderizarCanales(lista) {
  const listContainer = document.getElementById('channelList');
  listContainer.innerHTML = '';

  if (lista.length === 0) {
    listContainer.innerHTML = '<p class="loading-text">No se encontraron elementos.</p>';
    return;
  }

  // Cargar primeros 300 elementos
  const limite = lista.slice(0, 300);

  limite.forEach((item) => {
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

// FILTRADO POR BÚSQUEDA
function filtrarCanales() {
  const query = document.getElementById('searchInput').value.toLowerCase();
  const filtrados = session.channels.filter(c => c.name.toLowerCase().includes(query));
  renderizarCanales(filtrados);
}

// REPRODUCCIÓN DE VIDEO
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

// NAVEGACIÓN Y SALIDA
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
