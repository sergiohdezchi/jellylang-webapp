# Jellylang Importer (extensión del navegador)

Importa videos de YouTube con sus subtítulos a tu biblioteca de Jellylang. Usa la sesión que ya tienes abierta en la web y obtiene los subtítulos desde tu navegador.

Funciona en Chrome, Edge y Brave (Manifest V3, Chrome 111 o superior). No tiene dependencias ni paso de compilación.

## Instalación

1. Abre `chrome://extensions` y activa el **Modo de desarrollador**.
2. Pulsa **Cargar descomprimida** y elige esta carpeta (`extension/`).
3. Inicia sesión en la web de Jellylang (por defecto `http://localhost:5173`).
4. Abre un video de YouTube, pulsa el icono de la extensión e **Importar**.

Si la pestaña de YouTube ya estaba abierta al instalar la extensión, recárgala una vez.

## Uso

El popup muestra el video de la pestaña y te deja elegir:

- **Título:** editable.
- **Idioma:** los que estudias en Jellylang.
- **Subtítulos:** solo si el video tiene varias pistas en ese idioma. Primero las manuales y luego las automáticas, marcadas como tales. Si no hay ninguna, te dice qué idiomas tiene el video.
- **Curso:** uno tuyo de ese idioma, ninguno o **Nuevo curso…**.
- **Nivel.**
- **Abrir la lección al terminar.**

Recuerda el último idioma y, para cada idioma, el último curso y nivel. Volver a importar un video actualiza la lección en lugar de duplicarla.

## Cómo funciona

| Archivo | Dónde corre | Qué hace |
|---------|-------------|----------|
| `youtube/inject.js` | content script | Inyecta `worker.js` en la página. |
| `youtube/worker.js` | página de YouTube | Al abrir un video (y al navegar a otro sin recargar), pide su información a `youtubei/v1/player` **identificándose como la app de Android**. Guarda el título, el autor, la duración, la miniatura y las pistas de subtítulos en un `div` oculto (`#JELLYLANG_YT`). |
| `youtube/contentscript.js` | content script (aislado) | Responde al popup (`GetVideoInfo`, `GetVideoTracks`, `GetVideoSubs`) con lo que dejó `worker.js` y descarga la pista elegida en formato `json3`. |
| `popup.js` | popup | Sesión, formulario y envío a `POST /api/v1/imports`. |

**Por qué el cliente de Android.** YouTube no deja descargar los subtítulos de su web sin un token que solo genera su reproductor. Con el cliente de Android devuelve URLs que sí funcionan. La versión del cliente está en la constante `ANDROID_CLIENT` de `youtube/worker.js`; si YouTube deja de aceptarla, hay que actualizarla a una versión reciente de la app de YouTube para Android.

**Sesión.** Al iniciar sesión en la web, la API guarda el token en la cookie `jellylang_token` (HttpOnly). La extensión la lee con el permiso `cookies` y la envía a la API como `Authorization: Bearer`. La API no acepta la cookie por sí sola para autenticar, así que no abre la puerta a ataques CSRF. Al cerrar sesión en la web, la cookie se borra y la extensión vuelve a pedir que inicies sesión.

## Aviso

La API del reproductor (`youtubei/v1/player`) es **interna y no está aprobada por YouTube**; es la misma técnica que usa `yt-dlp`, solo que se ejecuta desde tu navegador. Úsala para estudio personal.

## Privacidad

- Solo se ejecuta en `https://www.youtube.com/*`.
- Solo habla con YouTube y con tu servidor de Jellylang. No usa analítica ni servicios de terceros.
- No guarda contraseñas ni el token: el token lo lee de la cookie de la web cada vez.
- En `chrome.storage.local` guarda solo las direcciones del servidor y tus preferencias del formulario.

## Ajustes

El icono de ajustes del popup permite cambiar la URL de la API (por defecto `http://localhost:3000`) y la de la web (`http://localhost:5173`). Para un servidor que no sea `localhost`, Chrome pide permiso para acceder a él.

## Limitaciones

- El video necesita subtítulos en el idioma que estudias.
- Las transmisiones en directo no se pueden importar.
- Si YouTube cambia su API interna o retira la versión del cliente de Android, la importación dejará de funcionar hasta que se actualice. Mientras tanto, puedes subir un SRT/VTT desde la lección.
- Las pruebas automáticas usan un YouTube simulado. El funcionamiento contra YouTube real hay que comprobarlo a mano en el navegador.
