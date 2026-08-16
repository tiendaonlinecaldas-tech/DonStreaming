# Don Streaming IPTV

Reproductor IPTV para navegador (Xtream Codes y listas M3U/M3U8). Un solo archivo HTML, sin backend, sin build.

## Archivos

- `index.html` — la aplicación completa (HTML + CSS + JS en un solo archivo).
- `logo.png` — logo por defecto que se muestra en el login, la pantalla de carga y la barra superior. **Reemplázalo por tu propio logo** (mismo nombre `logo.png`, cuadrado, ideal 512x512px) y listo, no hay que tocar código.
- `netlify.toml` / `vercel.json` — configuración para que la app funcione bien como sitio de una sola página.

## Cómo poner tu logo (dos formas)

1. **Antes de subir a producción (recomendado):** reemplaza el archivo `logo.png` de esta carpeta por tu propio logo, con el mismo nombre, y despliega normalmente. Se verá igual para todos los que entren.
2. **Directo en el navegador (rápido, solo en tu equipo):** dentro de la app, haz clic sobre el logo (login, splash o barra superior) y selecciona una imagen desde tu computador. Se guarda en el navegador local (`localStorage`) y sobreescribe el `logo.png` solo en ese navegador — útil para probar antes de reemplazar el archivo real, pero no lo ven otros usuarios ni persiste si limpias datos del navegador.

## Desplegar en Netlify

1. Crea una cuenta en [netlify.com](https://netlify.com) si no tienes.
2. Sube esta carpeta a un repositorio de GitHub (ver abajo) o arrastra la carpeta directamente en "Deploys" de Netlify (Add new site → Deploy manually).
3. Si conectas por GitHub: Add new site → Import an existing project → elige el repo. No necesita build command ni carpeta especial, `netlify.toml` ya lo configura.

## Desplegar en Vercel

1. Crea una cuenta en [vercel.com](https://vercel.com).
2. Add New → Project → importa el repositorio de GitHub.
3. Framework Preset: "Other" (o "Static"). No requiere build command.

## Subir a GitHub

```bash
cd don-streaming-iptv
git init
git add .
git commit -m "Don Streaming IPTV"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/don-streaming-iptv.git
git push -u origin main
```

Luego conecta ese repositorio desde Netlify o Vercel (Import from GitHub) para que cada `git push` despliegue automáticamente.

## Notas importantes

- **Los datos de acceso al panel IPTV se guardan solo en el navegador de cada usuario** (localStorage), nunca se envían a ningún servidor propio.
- **Proxy CORS:** algunos paneles IPTV no permiten peticiones directas desde el navegador (CORS). La app usa un proxy público (`allorigins.win`) solo para la lista de reproducción (texto liviano), nunca para los segmentos de video. Si muchos canales fallan a la vez, es probable que el proxy público esté saturado o caído — en ese caso lo ideal es montar tu propio proxy (por ejemplo con una Netlify Function) en vez del público.
- **Canales que no cargan:** la app ya reintenta automáticamente con distintas extensiones (`.m3u8`, `.ts`, `.mp4`, `.mkv`) y con/sin proxy antes de rendirse, y muestra un botón "Reintentar". Si un canal puntual sigue sin cargar después de todo eso, casi siempre es porque esa señal está caída del lado del proveedor del panel IPTV, no de la app.
