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

function iniciarSesionXtream(e) {
  e.preventDefault();
  let server = document.getElementById('serverUrl').value.trim();
  const user = document.getElementById('username').value.trim();
  const pass = document.getElementById('password').value.trim();

  // Si no especifican http/https, agregarlo
  if (!server.startsWith('http://') && !server.startsWith('https://')) {
    server = 'http://' + server;
  }

  const apiUrl = `${server}/player_api.php?username=${user}&password=${pass}`;
  conectarIPTV(`/api/proxy?url=${encodeURIComponent(apiUrl)}`, user);
}

function iniciarSesionM3u(e) {
  e.preventDefault();
  const url = document.getElementById('m3uUrl').value.trim();
  conectarIPTV(`/api/proxy?url=${encodeURIComponent(url)}`, 'Lista M3U');
}

function conectarIPTV(proxyUrl, usuario) {
  const errorBox = document.getElementById('errorMessage');
  errorBox.classList.add('hidden');

  fetch(proxyUrl)
    .then(res => {
      if (!res.ok) throw new Error('No se pudo obtener datos del servidor IPTV.');
      return res.text();
    })
    .then(data => {
      // Si la respuesta es válida, pasamos al menú principal
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('appContainer').classList.remove('hidden');
      document.getElementById('userLogged').innerText = `Logged in : ${usuario}`;
    })
    .catch(err => {
      errorBox.innerText = 'Error al conectar. Verifica el usuario, la contraseña o la URL.';
      errorBox.classList.remove('hidden');
    });
}

function cerrarSesion() {
  document.getElementById('appContainer').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}

setInterval(() => {
  const clock = document.getElementById('clockDisplay');
  if (clock) {
    clock.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}, 1000);
