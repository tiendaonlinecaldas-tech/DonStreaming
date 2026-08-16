let hls = null;
let allParsedItems = [];
let filteredItems = [];
let displayedCount = 0;
const PAGE_SIZE = 60;
let currentMode = 'live';
let currentItem = null;
let useProxyMode = false;

const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const formFast = document.getElementById('form-fast');
const formM3U = document.getElementById('form-m3u');

const channelListEl = document.getElementById('channel-list');
const categorySelect = document.getElementById('category-select');
const searchChannelInput = document.getElementById('search-channel');
const videoPlayer = document.getElementById('video-player');
const proxyBtn = document.getElementById('proxy-toggle-btn');

function switchTab(type) {
  document.getElementById('tab-fast').classList.toggle('active', type === 'fast');
  document.getElementById('tab-m3u').classList.toggle('active', type === 'm3u');
  formFast.classList.toggle('hidden', type !== 'fast');
  formM3U.classList.toggle('hidden', type !== 'm3u');
}

window.addEventListener('DOMContentLoaded', () => {
  const savedUrl = localStorage.getItem('iptv_playlist_url');
  if (savedUrl) {
    showAppScreen();
    fetchChannelsDirect(savedUrl);
  }
});

formFast.addEventListener('submit', (e) => {
  e.preventDefault();
  let server = document.getElementById('fast-server').value.trim();
  const u = document.getElementById('fast-user').value.trim();
  const p = document.getElementById('fast-pass').value.trim();
  if (!server.startsWith('http')) server = 'http://' + server;
  server = server.replace(/\/+$/, '');
  
  const m3uUrl = `${server}/get.php?username=${encodeURIComponent(u)}&password=${encodeURIComponent(p)}&type=m3u_plus&output=ts`;
  executeLogin(m3uUrl);
});

formM3U.addEventListener('submit', (e) => {
  e.preventDefault();
  executeLogin(document.getElementById('m3u-url-input').value.trim());
});

function executeLogin(m3uUrl) {
  localStorage.setItem('iptv_playlist_url', m3uUrl);
  showAppScreen();
  fetchChannelsDirect(m3uUrl);
}

async function fetchChannelsDirect(url) {
  channelListEl.innerHTML = '<li style="padding:1rem;color:#818cf8;">⚡ Descargando lista de canales...</li>';

  try {
    const res = await fetch(url);
    if (res.ok) {
      const text = await res.text();
      if (text && text.includes('#EXTINF')) {
        parseM3UFast(text);
        return;
      }
    }
  } catch (err) {
    console.warn("Conexión directa M3U falló, intentando vía proxy...", err);
  }

  try {
    const proxyUrl = "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const text = await res.text();
      if (text && text.includes('#EXTINF')) {
        parseM3UFast(text);
        return;
      }
    }
  } catch (e) {}

  channelListEl.innerHTML = `
    <li style="padding:1rem;color:#ef4444;text-align:center;">
      ❌ No se pudo cargar la lista.<br><br>
      <button onclick="logout()" style="background:#ef4444;color:#fff;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:bold;">
        Volver a Iniciar Sesión
      </button>
    </li>`;
}

function parseM3UFast(content) {
  allParsedItems = [];
  const lines = content.split('\n');
  let currentName = '', currentLogo = '', currentGroup = 'General';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      const logoIdx = line.indexOf('tvg-logo="');
      if (logoIdx !== -1) {
        const end = line.indexOf('"', logoIdx + 10);
        currentLogo = line.substring(logoIdx + 10, end);
      } else { currentLogo = ''; }

      const groupIdx = line.indexOf('group-title="');
      if (groupIdx !== -1) {
        const end = line.indexOf('"', groupIdx + 13);
        currentGroup = line.substring(groupIdx + 13, end);
      } else { currentGroup = 'General'; }

      const commaIdx = line.lastIndexOf(',');
      currentName = commaIdx !== -1 ? line.substring(commaIdx + 1) : 'Sin Nombre';
    } else if (line.startsWith('http://') || line.startsWith('https://')) {
      let type = 'live';
      const urlLower = line.toLowerCase();
      const grpLower = currentGroup.toLowerCase();

      if (urlLower.includes('/movie/')) type = 'movie';
      else if (urlLower.includes('/series/')) type = 'series';
      else if (urlLower.includes('/live/')) type = 'live';
      else {
        if (urlLower.endsWith('.mp4') || urlLower.endsWith('.mkv')) type = 'movie';
        else {
          const isSeriesGrp = (grpLower.includes('series') || grpLower.includes('temporada')) && !grpLower.includes('canales');
          const isMovieGrp = (grpLower.includes('peliculas') || grpLower.includes('estrenos')) && !grpLower.includes('canales');
          if (isSeriesGrp) type = 'series';
          else if (isMovieGrp) type = 'movie';
          else type = 'live';
        }
      }

      allParsedItems.push({ name: currentName, logo: currentLogo, group: currentGroup, url: line, type });
    }
  }

  setMode(currentMode);
}

function setMode(mode) {
  currentMode = mode;
  document.getElementById('nav-live').classList.toggle('active', mode === 'live');
  document.getElementById('nav-movie').classList.toggle('active', mode === 'movie');
  document.getElementById('nav-series').classList.toggle('active', mode === 'series');

  populateCategories();
  filterAndRender(true);
}

function populateCategories() {
  const items = allParsedItems.filter(i => i.type === currentMode);
  const categories = new Set(items.map(i => i.group));
  categorySelect.innerHTML = `<option value="ALL">📂 Todas las categorías (${items.length})</option>`;
  Array.from(categories).sort().forEach(cat => {
    categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
  });
}

function filterAndRender(reset = true) {
  if (reset) { displayedCount = 0; channelListEl.innerHTML = ''; }
  const search = searchChannelInput.value.toLowerCase();
  const cat = categorySelect.value;

  filteredItems = allParsedItems.filter(i => 
    i.type === currentMode &&
    (!search || i.name.toLowerCase().includes(search)) &&
    (cat === 'ALL' || i.group === cat)
  );

  renderMoreItems();
}

function renderMoreItems() {
  const nextBatch = filteredItems.slice(displayedCount, displayedCount + PAGE_SIZE);
  const fragment = document.createDocumentFragment();

  nextBatch.forEach(item => {
    const li = document.createElement('li');
    li.className = 'channel-item';
    li.innerHTML = `
      <img class="channel-logo" src="${item.logo || 'logo.png'}" onerror="this.onerror=null; this.src='https://cdn-icons-png.flaticon.com/512/3163/3163478.png';">
      <div>
        <div class="channel-name">${item.name}</div>
        <div class="channel-group">${item.group}</div>
      </div>
    `;
    li.onclick = () => playItem(item, li);
    fragment.appendChild(li);
  });

  channelListEl.appendChild(fragment);
  displayedCount += nextBatch.length;
}

searchChannelInput.addEventListener('input', () => filterAndRender(true));
categorySelect.addEventListener('change', () => filterAndRender(true));

function toggleProxyMode() {
  useProxyMode = !useProxyMode;
  if (useProxyMode) {
    proxyBtn.classList.add('active');
    proxyBtn.textContent = '⚡ Proxy: ON (Bypass CORS)';
  } else {
    proxyBtn.classList.remove('active');
    proxyBtn.textContent = '⚡ Proxy: OFF';
  }
  if (currentItem) {
    playItem(currentItem, null);
  }
}

function playItem(item, element) {
  currentItem = item;
  if (element) {
    document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
  }

  document.getElementById('current-channel-title').textContent = item.name;
  document.getElementById('current-channel-logo').src = item.logo || 'https://cdn-icons-png.flaticon.com/512/3163/3163478.png';
  document.getElementById('current-channel-status').textContent = '▶️ Conectando ' + item.name + '...';

  if (hls) { hls.destroy(); hls = null; }
  videoPlayer.pause();
  videoPlayer.removeAttribute('src');
  videoPlayer.load();

  let targetUrl = item.url;
  if (useProxyMode) {
    targetUrl = 'https://corsproxy.io/?' + encodeURIComponent(item.url);
  }

  if (Hls.isSupported() && (targetUrl.includes('.m3u8') || targetUrl.includes('/live/'))) {
    hls = new Hls({ enableWorker: true });
    hls.loadSource(targetUrl);
    hls.attachMedia(videoPlayer);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      videoPlayer.play().then(() => {
        document.getElementById('current-channel-status').textContent = '▶️ Transmitiendo ' + item.name;
      }).catch(() => {});
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        fallbackDirect(targetUrl, item.name);
      }
    });
  } else {
    fallbackDirect(targetUrl, item.name);
  }
}

function fallbackDirect(url, name) {
  videoPlayer.src = url;
  videoPlayer.play().then(() => {
    document.getElementById('current-channel-status').textContent = '▶️ Transmitiendo ' + name;
  }).catch(() => {
    if (window.location.protocol === 'https:' && url.startsWith('http://')) {
      document.getElementById('current-channel-status').innerHTML = '⚠️ <b>Bloqueo Mixed Content:</b> Habilita "Contenido no seguro" en el candado 🔒 del navegador (arriba a la izquierda) o activa el botón <b>⚡ Proxy: ON</b> arriba.';
    } else {
      document.getElementById('current-channel-status').innerHTML = '⚠️ Canal no disponible temporalmente en el panel IPTV o requiere activar el botón <b>⚡ Proxy: ON</b>.';
    }
  });
}

function logout() {
  localStorage.removeItem('iptv_playlist_url');
  location.reload();
}

document.getElementById('reload-btn').addEventListener('click', () => {
  const savedUrl = localStorage.getItem('iptv_playlist_url');
  if (savedUrl) fetchChannelsDirect(savedUrl);
});

document.getElementById('logout-btn').addEventListener('click', logout);

function showAppScreen() {
  loginScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
}
