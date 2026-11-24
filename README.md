<p align="center"><img src="web/public/logo.png" alt="Jellylang" width="360" /></p>

# Jellylang

Aplicación web para aprender idiomas mediante **lectura y escucha de contenido real**: textos, artículos y videos de YouTube. Lees, haces clic en las palabras que no conoces, las guardas como **LingQs** y las repasas con repetición espaciada.

> Proyecto independiente inspirado en el método de LingQ. "LingQ" es una marca de sus propietarios; aquí solo se usa como nombre genérico de "palabra guardada".

## Inicio rápido

Requisitos: **Docker** y **Docker Compose**. No hace falta instalar Ruby, Node ni PostgreSQL.

```bash
cp .env.example .env        # y cambia SECRET_KEY_BASE y JWT_SECRET
docker compose up --build
```

Al arrancar, la API crea la base de datos, ejecuta las migraciones y carga los datos iniciales.

| Servicio | URL |
|----------|-----|
| Aplicación | http://localhost:5173 |
| API | http://localhost:3000/api/v1 |
| Panel de Sidekiq (solo desarrollo) | http://localhost:3000/sidekiq |
| Correos enviados — Mailpit (solo desarrollo) | http://localhost:8025 |
| Vista previa de las plantillas de correo (solo desarrollo) | http://localhost:3000/rails/mailers |

Usuarios iniciales (solo en desarrollo; ver [Usuarios iniciales (seeds)](#usuarios-iniciales-seeds)):

| Usuario | Email | Contraseña |
|---------|-------|------------|
| Administrador | admin@jellylang.com | Medusa-Azul-2026 |
| Ejemplo (español → inglés, con una lección) | example@jellylang.com | Medusa-Azul-2026 |

Si tu base de datos se sembró antes con `password123`, esas cuentas conservan su contraseña (los seeds nunca la cambian).

---

## Índice

1. [Stack](#stack)
2. [Características](#características)
3. [Cómo funciona](#cómo-funciona)
4. [Arquitectura](#arquitectura)
5. [Modelo de datos](#modelo-de-datos)
6. [API REST](#api-rest)
7. [Estructura del proyecto](#estructura-del-proyecto)
8. [Desarrollo](#desarrollo)
9. [Despliegue en producción](#despliegue-en-producción)
10. [Variables de entorno](#variables-de-entorno)
11. [Solución de problemas](#solución-de-problemas)
12. [Roadmap](#roadmap)
13. [Consideraciones legales](#consideraciones-legales)

---

## Stack

| Capa | Tecnología |
|------|------------|
| Contenedores | Docker + Docker Compose |
| Frontend | React 19 + TypeScript + Vite, React Router, TanStack Query |
| Estilos | SCSS (módulos + variables CSS, modo claro y oscuro) |
| Backend | Ruby on Rails 8.1 (modo API), Ruby 3.3 |
| Base de datos | PostgreSQL 16 |
| Caché y colas | Redis 7 + Sidekiq |
| Video | YouTube IFrame Player API (reproductor oficial incrustado) |
| Subtítulos y metadatos | `yt-dlp` (+ `deno`) en la imagen del backend |
| Traducción | MyMemory (gratis, sin clave) o DeepL si defines `DEEPL_API_KEY` |
| Autenticación | `has_secure_password` + JWT |
| Tests | RSpec + WebMock (backend), Vitest (frontend) |

---

## Características

### Biblioteca
- Importar lecciones desde **YouTube** (con la [extensión del navegador](#importación-con-la-extensión-del-navegador) o, si lo activas, por URL), **texto pegado**, **URL de artículo** y **archivos** TXT, SRT o VTT.
- Cursos para agrupar lecciones; filtros por curso, nivel y título.
- Las importaciones de YouTube se procesan en segundo plano y la tarjeta muestra el progreso.

### Lector interactivo
- Cada palabra es clicable y abre un panel con sugerencias de traducción, diccionarios externos (Google Translate, Wiktionary, Reverso, WordReference) y pronunciación (síntesis de voz del navegador).
- Colores según el conocimiento:
  - **Azul**: palabra nueva.
  - **Amarillo** (de intenso a suave): LingQ de nivel 1 a 4.
  - **Sin color**: conocida o ignorada.
- **Frases**: selecciona varias palabras con el ratón para guardarlas como un LingQ; aparecen subrayadas en el texto.
- Lecciones de texto paginadas (~220 palabras). Al pasar de página, las palabras azules se marcan como conocidas (como en LingQ).
- Atajos de teclado con el panel abierto: <kbd>1</kbd>–<kbd>4</kbd> nivel, <kbd>K</kbd> conocida, <kbd>X</kbd> ignorar, <kbd>Esc</kbd> cerrar.

### Lector sincronizado con video
- Video arriba (móvil) o a la izquierda (escritorio) y transcripción con la **frase activa resaltada**.
- Además se marca la **palabra que se está diciendo**, pero solo cuando hay tiempos reales por palabra: los subtítulos automáticos de YouTube (error típico de unas decenas de ms). Con subtítulos manuales YouTube no da ese dato, y como estimarlo marcaba palabras equivocadas, se resalta solo la frase.
- Clic en el tiempo de una frase para reproducir desde ahí; frase anterior/siguiente, repetir y **bucle de frase**.
- Velocidad de 0.5× a 2×; pausa automática al abrir una palabra (opcional).
- Cada LingQ guarda el momento del video: desde el vocabulario o el repaso puedes volver a esa frase (`?t=segundos`).

### Lectura en voz alta de textos
- Las lecciones de texto, artículos y archivos se pueden **escuchar** con la síntesis de voz del navegador, con los mismos controles que el video (frase anterior/siguiente, repetir, bucle, velocidad).
- Se resalta la frase que se lee y, si la voz informa de ello, también la palabra; al terminar la página, el lector pasa a la siguiente.
- La voz se elige en el menú de ajustes de reproducción (se recuerda por idioma). Las voces disponibles dependen del navegador y del sistema operativo.
- Desde el panel de una palabra, **Escuchar frase** reproduce (video o voz) la frase donde aparece.

### Seguimiento del texto y móvil
- El auto-scroll mantiene la palabra que suena en la **zona visible real**: debajo de la cabecera, del video o de la barra de audio, y por encima del panel de palabra en móvil. Solo desplaza cuando lo leído sale de la zona cómoda.
- Si haces scroll a mano, el seguimiento se detiene unos segundos para no pelear contigo.
- Las opciones de reproducción (auto-scroll, pausa al abrir palabra, voz) están en un menú compacto; los avisos ya no quedan fijos sobre el texto.
- En pantallas de menos de 1240 px el panel de palabra es una hoja inferior; con el video en pausa y una palabra abierta, el video deja de estar fijo para ganar espacio.

### Vocabulario y repaso
- Lista de LingQs con búsqueda, filtros por nivel y tipo (palabra/frase) y edición en línea del significado.
- Exportación a **CSV** y a **Anki** (TSV con anverso, reverso con contexto y etiquetas).
- Repaso con **SM-2** (Otra vez / Difícil / Bien / Fácil) mostrando el próximo intervalo de cada botón.
- Dos modos: **tarjetas** y **escritura** (escribes la palabra a partir del significado y el contexto).

### Progreso
- Palabras conocidas, LingQs, racha diaria, palabras leídas, horas de escucha y repasos pendientes.
- Meta diaria de LingQs nuevos por idioma y gráfico de los últimos 7 días.
- Las estadísticas usan la zona horaria del navegador (cabecera `X-Timezone`).

### Panel de administración
- En `/admin` (icono de escudo en la cabecera, solo para administradores):
  - **Resumen:** usuarios, actividad de la semana, lecciones, LingQs e importaciones fallidas recientes (útil para ver si yt-dlp dejó de funcionar).
  - **Ajustes:** activar o desactivar la importación con yt-dlp y el registro abierto. Se aplican al momento en la API y en el worker.
  - **Usuarios:** buscar, crear cuentas (también con el registro cerrado), dar o quitar el rol de administrador, desactivar (corta sus sesiones al momento), cambiar la contraseña y borrar con todos sus datos.
  - **Idiomas:** añadir (código ISO 639 de 2-3 letras), renombrar, desactivar (deja de ofrecerse, pero quien ya lo estudia lo conserva) y borrar si nadie lo usa.
- Nadie puede quitarse el rol de administrador, desactivarse ni borrarse a sí mismo, así que siempre queda al menos un administrador.

**Ajustes: panel, entorno y valor por defecto.** Cada ajuste usa el valor guardado en el panel; si no hay, el de su variable de entorno (`YTDLP_ENABLED`, `SIGNUPS_ENABLED`); y si tampoco, el valor por defecto (activado). El panel indica de dónde sale el valor y permite volver al de la variable de entorno.

**Primer administrador.** Lo crean los seeds (ver [Usuarios iniciales (seeds)](#usuarios-iniciales-seeds)). Para convertir en administrador a un usuario que ya existe:

```bash
docker compose exec api bin/rails "admin:grant[tu@email.com]"
docker compose exec api bin/rails admin:list      # ver administradores
```

### Usuarios iniciales (seeds)

`api/db/seeds.rb` crea los idiomas, un **administrador** y un **usuario de ejemplo** (habla español, aprende inglés, con un curso y una lección). Se ejecuta solo al crear la base de datos; para lanzarlo a mano (por ejemplo, en el servidor):

```bash
docker compose exec api bin/rails db:seed
```

- Es **idempotente**: solo crea lo que falta y nunca cambia la contraseña de un usuario que ya existe.
- Los datos se configuran con variables de entorno: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `EXAMPLE_EMAIL` y `EXAMPLE_PASSWORD`.
- En desarrollo y pruebas, la contraseña por defecto es `Medusa-Azul-2026` (`admin@jellylang.com` y `example@jellylang.com`). Las cuentas de los seeds se crean con el email ya verificado.
- `ADMIN_PASSWORD` y `EXAMPLE_PASSWORD` deben cumplir la [política de contraseñas](#contraseñas); si no, los seeds fallan.
- **En producción no hay contraseñas por defecto.** Si no defines `ADMIN_PASSWORD` o `EXAMPLE_PASSWORD`, se genera una aleatoria y se muestra una sola vez en la salida del comando. Guárdala, o define las variables antes de ejecutar los seeds.
- Si no quieres el usuario de ejemplo en producción, bórralo desde el panel de administración después del primer arranque.

Con la base de datos vacía el registro siempre está abierto, para poder crear la primera cuenta.

### Cuentas e idiomas
- Registro con email confirmado por un código de 6 dígitos (ver [Registro con código](#registro-con-código-por-correo)).
- Contraseñas robustas, con los requisitos a la vista mientras se escriben (ver [Contraseñas](#contraseñas)).
- Varios idiomas de estudio por usuario, cada uno con su meta diaria.
- Idiomas incluidos: inglés, español, francés, alemán, italiano, portugués, neerlandés y ruso.
- Interfaz en español e inglés.
- Correos con diseño (código de verificación y bienvenida) en el idioma de la interfaz, enviados con Zoho (ver [Correo con Zoho](#correo-con-zoho)).

---

## Cómo funciona

### Registro con código por correo

1. `POST /auth/signup` crea la cuenta **sin verificar** y responde `202` con `{ verification_required, email, resend_in }` (sin token).
2. El worker genera un código de 6 dígitos y lo envía por correo. En la base de datos solo se guarda su HMAC, nunca el código.
3. La web muestra la pantalla «Revisa tu correo». `POST /auth/verify_email` con email, **contraseña** y código marca el email como verificado, devuelve el token y envía el correo de bienvenida.

Reglas:

- El código caduca a los **15 minutos** y admite **5 intentos**. Al agotarlos, la cuenta queda **bloqueada 15 minutos** (`429`, `code: "locked"`, `retry_in` en segundos): ni el código correcto ni pedir otro sirven hasta que pase; la web muestra la cuenta atrás. Entre envíos hay que esperar **60 segundos** (`POST /auth/resend_code`).
- Para verificar también se pide la contraseña. Así, quien solo tenga acceso al correo no puede quedarse con una cuenta registrada por otra persona, y viceversa.
- Si alguien inicia sesión sin haber verificado, recibe `403` con `code: "email_not_verified"`. Se le envía un código nuevo si no tenía uno vigente, y la web le muestra la pantalla del código.
- Un registro abandonado no bloquea el email: si se repite el registro con ese email, se sustituyen los datos y se envía otro código.
- Además, la API limita por IP los intentos de login, registro, verificación y reenvío (`rate_limit` de Rails, contado en Redis); al superarlos responde `429`.
- Las cuentas creadas por un administrador o por los seeds, y las que ya existían al añadir esta función, se dan por verificadas.
- **No hay registros sin correo:** si el servidor no puede enviar correos (en producción, sin `SMTP_USERNAME`/`SMTP_PASSWORD`), `POST /auth/signup` responde `503 mail_unavailable` y `GET /config` devuelve `signups_enabled: false`, así que la web muestra el registro como cerrado. Los administradores siguen pudiendo crear cuentas desde el panel.

### Recuperar la contraseña

1. En el login, «¿Olvidaste tu contraseña?» (`/forgot-password`) pide el email. `POST /auth/forgot_password` responde siempre `202`, exista o no la cuenta, para no revelar qué emails están registrados.
2. Si la cuenta existe y está activa, llega un código de 6 dígitos con las mismas reglas que el de registro (15 minutos, 5 intentos, bloqueo de 15 minutos, 60 s entre envíos).
3. `POST /auth/reset_password` con `email`, `code` y `password` cambia la contraseña e inicia sesión. Si la contraseña nueva no cumple las reglas, se rechaza **sin gastar el código**.
4. Cambiar la contraseña **cierra todas las sesiones anteriores** (los tokens llevan `iat` y se rechazan los emitidos antes de `password_changed_at`). Si el email estaba sin verificar, queda verificado.

### Contraseñas

Se validan en la API (`api/app/services/password_policy.rb`) y la web muestra las mismas reglas mientras se escribe (`web/src/lib/passwordPolicy.ts`). Si cambias una, cambia la otra:

- Al menos **10 caracteres** (y como mucho 72 bytes, el límite de bcrypt).
- Al menos una **minúscula**, una **mayúscula** y un **número**. Los símbolos no son obligatorios, pero suben la fuerza.
- No puede repetir el mismo carácter 4 veces seguidas.
- No puede contener palabras o secuencias muy comunes (`password`, `qwerty`, `123456`, `jellylang`…).
- No puede contener la parte del email antes de la `@`.

Se aplican al registrarse, al crear un usuario desde el panel y al cambiar una contraseña. Las cuentas que ya existían siguen entrando con su contraseña actual. Las contraseñas se guardan con bcrypt (`has_secure_password`), y el login responde con un mensaje genérico que no revela si el email existe.

### reCAPTCHA

Registro, login y «olvidé mi contraseña» piden **reCAPTCHA v2** («No soy un robot»). La API verifica el token con Google antes de hacer nada (`api/app/services/captcha.rb`); si Google lo niega o no responde, devuelve `422 captcha_failed`. Cada token sirve una sola vez, por eso la web reinicia la casilla tras cada envío. Verificar el código del correo y cambiar la contraseña no lo piden: ya exigen la contraseña o el código.

- **Producción:** crea las claves en https://www.google.com/recaptcha/admin (tipo *Desafío (v2) > Casilla «No soy un robot»*), añade tu dominio y define `RECAPTCHA_SITE_KEY` y `RECAPTCHA_SECRET_KEY` en `.env`. La clave del sitio llega a la web desde `GET /config` (no hay que recompilar). **Sin las dos claves no se pide captcha.**
- **Desarrollo:** `docker-compose.yml` usa las claves de prueba de Google, que siempre aprueban y muestran el aviso «solo para pruebas». Para probar con las reales, defínelas en `.env`.
- La web carga el script de Google (`google.com/recaptcha`); si tienes una política CSP, permite `google.com` y `gstatic.com`.
- Los límites por IP y los bloqueos de código siguen activos aparte del captcha.

### Importación con la extensión del navegador

La extensión ([extension/](extension/README.md)) es la forma recomendada de importar videos de YouTube. Sigue el mismo esquema que el importador de LingQ y funciona desde tu navegador, **sin que el servidor consulte a YouTube**:

1. **Sesión:** inicias sesión en la web de Jellylang. Al hacerlo, la API deja el token en la cookie `jellylang_token` (HttpOnly). La extensión la lee y no necesita un inicio de sesión propio; al salir de la web, la cookie se borra.
2. **Datos del video:** al abrir un video, la extensión pide su información y sus pistas de subtítulos a la API del reproductor de YouTube (`youtubei/v1/player`), **identificándose como la app de Android**. Con ese cliente, YouTube devuelve URLs de subtítulos que se pueden descargar sin el token que exige su web.
3. **Formulario:** en el popup eliges idioma, pista de subtítulos, curso (o uno nuevo) y nivel, y puedes editar el título.
4. **Importación:** la extensión descarga la pista en formato `json3` y la envía a `POST /api/v1/imports`. La API crea las frases con tiempos y, con subtítulos automáticos, el tiempo real de cada palabra.

Volver a importar el mismo video actualiza la lección en lugar de duplicarla.

> La API del reproductor es **interna y no está aprobada por YouTube**; es la misma técnica que usa `yt-dlp`. La diferencia es que se ejecuta desde tu navegador y no desde el servidor. Consulta [Consideraciones legales](#consideraciones-legales).

### Importación de YouTube con yt-dlp (opcional)

Si `YTDLP_ENABLED=true` (valor por defecto), también se puede importar pegando una URL, y es el **servidor** quien consulta a YouTube. Con `YTDLP_ENABLED=false` esa vía se cierra del todo: la API responde `403` (`code: ytdlp_disabled`) a `POST /lessons/youtube` y a `POST /lessons/:id/reimport`, los trabajos que ya estaban en cola terminan como fallidos sin consultar a YouTube, y la interfaz muestra la guía de la extensión en lugar del formulario de URL. Subir un SRT/VTT y la extensión siguen funcionando.

Flujo con yt-dlp activado:

1. El usuario pega una URL (`watch?v=`, `youtu.be/`, `shorts/`, `embed/`, `live/`).
2. La API extrae el ID, crea la lección en estado `processing` y encola `ImportYoutubeLessonJob`.
3. El job obtiene los metadatos con `yt-dlp --dump-single-json` y elige la mejor pista de subtítulos:

   | Prioridad | Fuente | Notas |
   |-----------|--------|-------|
   | 1 | Subtítulos manuales en el idioma de estudio | Mejor calidad |
   | 2 | Subtítulos automáticos **en el idioma original** del video | Pueden tener errores; se avisa en el lector |
   | 3 | Subida manual de SRT/VTT desde la propia lección | Plan B si falla lo anterior |

   Las traducciones automáticas de YouTube se descartan porque no coinciden con el audio.
4. Se descarga solo el archivo de subtítulos (`--skip-download`), nunca el video.
5. El texto se limpia y se agrupa en frases con tiempos (`segments`); la lección pasa a `ready`.
   Si los subtítulos traen el inicio de cada palabra (los automáticos de YouTube: `hola<00:00:01.230><c> mundo</c>`), se guardan en `segments.word_times`. Los videos importados antes de este dato, o que ya tenían subtítulos manuales, no lo tienen.

El frontend consulta el estado cada 2 segundos mientras la lección está en `processing`.

Limpieza de subtítulos ([parser.rb](api/app/services/subtitles/parser.rb), [builder.rb](api/app/services/subtitles/builder.rb)):
- Elimina etiquetas HTML, marcas de tiempo internas y anotaciones como `[Música]` o `♪`.
- Quita las líneas repetidas en cascada de los subtítulos automáticos.
- Une fragmentos en frases completas (corta por puntuación final, 200 caracteres, 12 segundos o pausas largas) conservando `start` y `end`.

### Sincronización del lector

Video y voz implementan el mismo contrato [`Playback`](web/src/components/Reader/playback.ts) (frase activa, palabra activa, reproducir, saltar, bucle, velocidad), así que comparten controles y seguimiento.

- **Video** ([useYouTubePlayback.ts](web/src/hooks/useYouTubePlayback.ts)): consulta el reproductor cada 80 ms y, como el iframe informa el tiempo a saltos, lo extrapola con el reloj local y la velocidad. La frase activa se busca con búsqueda binaria ([segments.ts](web/src/lib/segments.ts)) y la palabra con `word_times`, solo si [exactWordTimes](web/src/lib/wordTiming.ts) los da completos (uno por palabra, crecientes y dentro de la frase); si falta alguno, esa frase no marca palabra. Nada se estima.
- **Voz** ([useSpeechPlayback.ts](web/src/hooks/useSpeechPlayback.ts)): lee frase a frase con `SpeechSynthesisUtterance`. La palabra activa sale de los eventos `boundary`; si la voz no los emite (por ejemplo, las voces en red de Chrome), solo se resalta la frase.
- **Seguimiento** ([readingZone.ts](web/src/lib/readingZone.ts)): los elementos fijos se marcan con `data-reading-obstruction="top" | "bottom"` y el scroll coloca lo leído entre ellos.

### Tokenización

El backend y el frontend usan la misma expresión regular para separar palabras y la misma normalización (NFC, minúsculas, apóstrofo recto, sin puntuación en los extremos). Si cambias una, cambia la otra:
- [api/app/services/text/tokenizer.rb](api/app/services/text/tokenizer.rb)
- [web/src/lib/tokenize.ts](web/src/lib/tokenize.ts)

---

## Arquitectura

```
                    ┌─────────────────────┐
                    │  web (React + Vite) │  proxy /api → api:3000
                    └───────┬─────────────┘
          IFrame API │      │ REST / JSON
      ┌──────────────┘      ▼
┌───────────┐       ┌─────────────────────┐       ┌──────────────┐
│  YouTube  │       │   api (Rails API)   │ ────► │  PostgreSQL  │
└───────────┘       └───────┬─────────────┘       └──────────────┘
                            │ encola jobs / caché de traducciones
                            ▼
                    ┌─────────────────────┐       ┌──────────────┐
                    │  worker (Sidekiq)   │ ────► │    Redis     │
                    │  yt-dlp, parseo     │       │ colas + caché│
                    └─────────────────────┘       └──────────────┘
```

---

## Modelo de datos

```
languages(code, name, enabled)
app_settings(key, value, updated_by_id)          -- ajustes del panel de administración
users(email, password_digest, name, ui_language, native_language, current_language_id,
      admin, disabled_at, email_verified_at, verification_code_digest,
      verification_code_sent_at, verification_attempts, verification_locked_until,
      reset_code_digest, reset_code_sent_at, reset_attempts, reset_locked_until, password_changed_at)
user_languages(user_id, language_id, daily_goal)

courses(user_id, language_id, title, description)
lessons(user_id, language_id, course_id, title, source_type, source_url, youtube_id,
        thumbnail_url, author, duration, level, status, subtitle_source, error_message,
        word_count, progress_page, completed_at, last_opened_at)
segments(lesson_id, position, paragraph, text, start_time, end_time)

words(language_id, term, lemma)                    -- palabras y frases normalizadas
user_words(user_id, word_id, status, level)        -- ausente = palabra nueva
lingqs(user_id, word_id, language_id, lesson_id, segment_id, meaning, notes, context,
       video_time, is_phrase, next_review_at, interval, ease, repetitions)

review_logs(user_id, lingq_id, rating, reviewed_at)
daily_stats(user_id, language_id, date, words_read, listening_seconds,
            new_lingqs, known_words, reviews)
```

- `lessons.source_type`: `text | url | file | youtube`
- `lessons.status`: `processing | ready | failed`
- `user_words.status`: `learning | known | ignored` (el nivel 1–4 solo aplica a `learning`)
- Índices únicos: `words(language_id, term)`, `user_words(user_id, word_id)`, `lingqs(user_id, word_id)`, `daily_stats(user_id, language_id, date)`.

---

## API REST

Todas las rutas cuelgan de `/api/v1` y, salvo registro, login e idiomas, requieren `Authorization: Bearer <token>`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/auth/signup` | Registro. Con correo configurado responde `202` y envía un código; si no, devuelve el JWT |
| POST | `/auth/verify_email` | `email`, `password` y `code`: confirma el email y devuelve el JWT |
| POST | `/auth/resend_code` | `email` y `password`: envía otro código (máximo uno por minuto) |
| POST | `/auth/forgot_password` | `email`: envía un código para cambiar la contraseña (responde igual exista o no la cuenta) |
| POST | `/auth/reset_password` | `email`, `code` y `password`: cambia la contraseña e inicia sesión |
| POST | `/auth/login` | Login (devuelve JWT; `403 email_not_verified` si falta confirmar el email) |
| GET | `/auth/me` | Usuario actual (renueva también la cookie de sesión de la extensión) |
| DELETE | `/auth/session` | Borra la cookie de sesión que usa la extensión (al cerrar sesión en la web) |
| PATCH | `/auth/me` | Perfil, idiomas de estudio, metas e idioma actual |
| GET | `/languages` | Idiomas disponibles |
| GET, POST, PATCH, DELETE | `/courses` | Cursos |
| GET | `/lessons` | Listar lecciones (`language_id`, `course_id`, `level`, `q`) |
| POST | `/lessons` | Crear lección: `source_type` = `text` (`content`), `url` (`url`) o `file` (multipart) |
| POST | `/lessons/youtube` | Importar desde YouTube con yt-dlp (respuesta 202; `403` si `YTDLP_ENABLED=false`) |
| POST | `/imports` | Crear o actualizar una lección desde un cliente externo (la extensión): `source`, `language_id`, `video`, `track` con `format` (`json3`, `vtt` o `srt`) y `content`; opcionales `course_id` o `course_title` (crea el curso si no existe) y `level` |
| GET | `/config` | Capacidades del servidor (`ytdlp_enabled`, `signups_enabled`, `import_sources`); no requiere sesión |
| GET | `/admin/overview` | Resumen del sistema (solo administradores, como todo `/admin`) |
| GET, PATCH, DELETE | `/admin/settings[/:key]` | Ver, cambiar o restablecer ajustes (`ytdlp_enabled`, `signups_enabled`) |
| GET, POST, PATCH, DELETE | `/admin/users[/:id]` | Usuarios: listar (`q`, `role`, `status`), crear, cambiar `admin`/`disabled`/`password`/`name`, borrar |
| GET, POST, PATCH, DELETE | `/admin/languages[/:id]` | Idiomas: listar con su uso, crear, renombrar/activar, borrar si no se usa |
| GET | `/lessons/:id` | Lección con segmentos, vocabulario del usuario y frases |
| PATCH | `/lessons/:id` | Título, curso, nivel, `progress_page`, `completed` |
| DELETE | `/lessons/:id` | Eliminar lección |
| POST | `/lessons/:id/subtitles` | Subir SRT/VTT manualmente |
| POST | `/lessons/:id/reimport` | Reintentar la importación de YouTube |
| GET | `/lingqs` | Listar LingQs (`q`, `level` 1–4 o `known`, `kind`, `page`) |
| GET | `/lingqs/export` | Exportar (`format_type` = `csv` o `anki`) |
| POST | `/lingqs` | Guardar palabra o frase |
| PATCH | `/lingqs/:id` | Significado, notas o nivel |
| DELETE | `/lingqs/:id` | Eliminar (la palabra vuelve a ser nueva) |
| PUT | `/user_words` | Cambiar el estado de una palabra (`new`, `learning`, `known`, `ignored`) |
| POST | `/user_words/bulk` | Marcar como conocidas varias palabras nuevas |
| GET | `/reviews/due` | Tarjetas pendientes con el intervalo de cada botón |
| POST | `/reviews` | Registrar resultado (`rating` 1–4) |
| GET | `/stats` | Estadísticas del idioma |
| POST | `/stats/activity` | Registrar palabras leídas y segundos de escucha |
| GET | `/dictionary` | Traducción automática (`term`, `from`, `to`) |

Los errores se devuelven como `{ "error": "mensaje" }` en el idioma de interfaz del usuario.

---

## Estructura del proyecto

```
.
├── api/                                # Rails API
│   ├── app/
│   │   ├── controllers/api/v1/         # auth, lessons, lingqs, user_words, reviews, stats…
│   │   ├── jobs/                       # ImportYoutubeLessonJob (Sidekiq)
│   │   ├── models/
│   │   └── services/
│   │       ├── articles/               # extracción de texto de páginas web
│   │       ├── lessons/                # texto/archivo/subtítulos → segmentos
│   │       ├── srs/                    # planificador SM-2
│   │       ├── stats/                  # resumen, racha
│   │       ├── subtitles/              # parser VTT/SRT y limpieza
│   │       ├── text/                   # tokenizador y segmentador de frases
│   │       ├── translation/            # MyMemory / DeepL
│   │       ├── vocabulary/             # estado de palabras por usuario
│   │       └── youtube/                # URL y cliente yt-dlp
│   ├── config/locales/                 # mensajes es/en
│   ├── db/
│   ├── spec/
│   ├── bin/docker-entrypoint
│   ├── Dockerfile
│   └── Dockerfile.prod                 # imagen de producción
├── extension/                          # Extensión de Chrome/Edge/Brave (Manifest V3)
│   ├── youtube/                        # inject.js · worker.js (en la página) · contentscript.js
│   ├── lib/ icons/   (icono: la medusa de Jellylang)
│   └── popup.html · popup.js           # formulario de importación
├── web/                                # React
│   ├── src/
│   │   ├── api/                        # cliente fetch y tipos
│   │   ├── auth/                       # contexto de sesión
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   ├── Reader/                 # TextReader, VideoReader, SegmentText
│   │   │   └── WordPanel/
│   │   ├── hooks/                      # reproducción (YouTube, voz), vocabulario, escucha…
│   │   ├── i18n/                       # mensajes es/en
│   │   ├── lib/                        # tokenize, segments, wordTiming, readingZone (+ tests)
│   │   ├── pages/
│   │   └── styles/                     # variables, mixins, estilos globales
│   ├── Dockerfile
│   ├── Dockerfile.prod                 # imagen de producción (SPA compilada + nginx)
│   └── nginx.conf                      # SPA + proxy de /api
├── docker-compose.yml                  # desarrollo
├── docker-compose.prod.yml             # producción (detrás de Caddy)
├── .env.example
├── .env.production.example
└── README.md
```

---

## Desarrollo

```bash
docker compose logs -f api worker                     # logs
docker compose exec api bin/rails console             # consola de Rails
docker compose exec api bin/rails db:migrate          # nuevas migraciones
docker compose down                                   # apagar
docker compose down -v                                # apagar y borrar datos
```

Tests:

```bash
# Backend (la primera vez crea la base de datos de test)
docker compose exec -e RAILS_ENV=test api bash -c "bin/rails db:prepare && bundle exec rspec"

# Frontend
docker compose exec web npm test
docker compose exec web npm run typecheck
```

Notas:
- El código se monta como volumen: los cambios se recargan sin reconstruir. Si cambias el `Gemfile` o `package.json`, basta con reiniciar el servicio (`docker compose restart api worker` o `web`): el arranque instala lo que falte.
- Los contenedores usan tu UID/GID (por defecto 1000) para que los archivos generados no queden como `root`. Si tu usuario tiene otro UID, exporta `UID` y `GID` antes de construir.
- El frontend llama a `/api/v1` y Vite lo redirige al contenedor `api`, así que en desarrollo no hay CORS.

### Correo en desarrollo

En Docker, todo el correo va a **Mailpit**: no sale nada a internet y cualquier dirección sirve para registrarse.

- **Bandeja:** http://localhost:8025. Ahí llegan el código de verificación y la bienvenida. La pantalla del código de la web enlaza a Mailpit (solo en desarrollo).
- **Vista previa de las plantillas sin enviar nada:** http://localhost:3000/rails/mailers (añade `?locale=en` para verlas en inglés). Las previsualizaciones están en `api/spec/mailers/previews/`.
- **Probar el registro completo:** abre http://localhost:5173/signup, regístrate con cualquier email, copia el código desde Mailpit y entra.
- Los correos los envía el worker de Sidekiq: si no llegan, mira `docker compose logs -f worker`.
- **Probar con Zoho de verdad desde local:** define `SMTP_ADDRESS`, `SMTP_PORT`, `SMTP_USERNAME` y `SMTP_PASSWORD` en `.env` y ejecuta `docker compose up -d api worker`.

---

## Despliegue en producción

Pensado para un VPS con Docker y un **Caddy** que ya corre en un contenedor y hace de proxy (HTTPS automático). Archivos: `docker-compose.prod.yml`, `api/Dockerfile.prod`, `web/Dockerfile.prod` y `web/nginx.conf`.

```
Internet ─► Caddy (HTTPS) ─► jellylang-web (nginx) ─┬─► SPA estática
                                                    └─► /api ─► jellylang-api (Rails)
                                       jellylang-worker (Sidekiq) · jellylang-db · jellylang-redis
```

Solo `jellylang-web` se une a la red de Docker del proxy. El resto queda en la red interna del proyecto y no publica puertos. Todos los servicios llevan el prefijo `jellylang-` para no chocar con contenedores de la red de Caddy que ya se llaman `web` o `nginx`.

**1. Caddy.** Añade un bloque (con `JELLYLANG_DOMAIN=jellylang.com` en el entorno de Caddy, o escribe el dominio directamente) y recarga:

```caddyfile
{$JELLYLANG_DOMAIN} {
        encode zstd gzip
        header Strict-Transport-Security "max-age=31536000"
        reverse_proxy jellylang-web:80
}
```

Los registros DNS `A` (y `AAAA`) de `jellylang.com` deben apuntar a la IP del VPS.

**2. Configuración.** En el servidor:

```bash
git clone <repositorio> jellylang && cd jellylang
cp .env.production.example .env
# Rellena DB_PASSWORD, SECRET_KEY_BASE y JWT_SECRET (openssl rand -hex 64)
# y PROXY_NETWORK con el nombre de la red de Caddy (docker network ls | docker inspect <contenedor-caddy>)
```

**3. Arranque.**

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs jellylang-api | grep -i "contraseña"   # contraseñas generadas
```

Al primer arranque la API crea la base de datos, migra y ejecuta los seeds (ver [Usuarios iniciales](#usuarios-iniciales-seeds)). Define `ADMIN_PASSWORD` en `.env` o guarda la contraseña que se imprime una sola vez.

**4. Actualizar.**

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build   # las migraciones se aplican solas
```

**5. Copia de seguridad de la base de datos.**

```bash
docker compose -f docker-compose.prod.yml exec -T jellylang-db pg_dump -U jellylang -Fc jellylang_production > jellylang-$(date +%F).dump
```

Notas:

- La web y la API comparten origen (`https://jellylang.com` y `/api`), así que no hace falta configurar CORS y la cookie de sesión de la extensión funciona sin más.
- `YTDLP_ENABLED` es `false` por defecto en producción: se importa con la extensión o subiendo SRT/VTT. Se puede activar desde `/admin`.
- **Extensión:** por defecto apunta a `localhost`. En el icono de ajustes del popup, pon la API `https://jellylang.com` y la web `https://jellylang.com`.
- Los volúmenes `postgres_data` y `redis_data` guardan los datos; `docker compose down` los conserva, `down -v` los borra.

### Correo con Zoho

Jellylang envía tres correos: el **código de verificación** al registrarse, la **bienvenida** al confirmar el email y el **código para cambiar la contraseña**. Salen del worker de Sidekiq (cola `mailers`, con reintentos), así que un fallo del servidor de correo nunca rompe una petición. Las cuentas creadas por un administrador o por los seeds no reciben ninguno.

1. En Zoho Mail, crea (o usa) la cuenta desde la que se enviará, por ejemplo `hola@jellylang.com`. El plan gratuito de Zoho no ofrece SMTP: hace falta un plan de pago.
2. Si la cuenta tiene verificación en dos pasos, crea una **contraseña de aplicación** (Zoho > Mi cuenta > Seguridad > Contraseñas de aplicación). Si no, vale la contraseña de la cuenta.
3. Define en `.env` (en el servidor):

   ```env
   SMTP_ADDRESS=smtp.zoho.com     # el de la región de tu cuenta: smtp.zoho.eu, smtp.zoho.in, smtp.zoho.com.au, smtp.zoho.jp...
   SMTP_PORT=587                  # 587 = STARTTLS, 465 = SSL
   SMTP_USERNAME=hola@jellylang.com
   SMTP_PASSWORD=la-contraseña-de-aplicación
   MAIL_FROM=                     # vacío = SMTP_USERNAME. Zoho solo deja enviar desde la cuenta o sus alias
   APP_URL=https://jellylang.com  # enlaces y logo del correo (se carga de APP_URL/logo.png)
   ```

4. Reinicia: `docker compose -f docker-compose.prod.yml up -d` (api y worker).
5. Para que no caigan en spam, configura en el DNS del dominio los registros **SPF**, **DKIM** y **DMARC** que te indica Zoho (Zoho > Panel de administración > Dominios > Correo).

Notas:

- Sin `SMTP_USERNAME` y `SMTP_PASSWORD`, en producción no se envía nada (se deja un aviso en el log), **el registro y la recuperación de contraseña quedan desactivados**.
- Probar el envío: `docker compose -f docker-compose.prod.yml exec jellylang-api bin/rails runner 'AccountMailer.with(user: User.find_by!(email: "tu@email.com")).welcome.deliver_now'`.
- Si un correo falla (credenciales, región equivocada…), el error aparece en `docker compose -f docker-compose.prod.yml logs jellylang-worker`.
- Las plantillas están en `api/app/views/account_mailer/` (con el diseño común en `api/app/views/layouts/mailer.html.erb`) y los textos en `api/config/locales/` (`mailers.*`).

---

## Variables de entorno

`.env.example` (desarrollo; para producción, `.env.production.example`):

```env
# Base de datos (el host y Redis los fija docker-compose.yml)
DB_USER=jellylang
DB_PASSWORD=jellylang

# Rails
RAILS_ENV=development
SECRET_KEY_BASE=cambia-esto-por-una-cadena-larga-y-aleatoria
JWT_SECRET=cambia-esto-tambien
CORS_ORIGINS=http://localhost:5173

# Traducción: con DEEPL_API_KEY se usa DeepL; vacío = MyMemory (gratis, sin clave)
DEEPL_API_KEY=

# Importación de YouTube con yt-dlp: el servidor consulta a YouTube por su cuenta.
# false = solo se importa con la extensión del navegador (carpeta extension/) o subiendo SRT/VTT.
YTDLP_ENABLED=true

# Correo (código de verificación y bienvenida). En Docker va a Mailpit: abre http://localhost:8025 para verlo.
# Para probar el envío real con Zoho desde local, descomenta y completa (ver README, "Correo con Zoho"):
# SMTP_ADDRESS=smtp.zoho.com
# SMTP_PORT=587
# SMTP_USERNAME=hola@jellylang.com
# SMTP_PASSWORD=
# MAIL_FROM="Jellylang <hola@jellylang.com>"   # por defecto, SMTP_USERNAME; Zoho solo permite la cuenta o sus alias
# APP_URL=http://localhost:5173                 # enlaces e imágenes del correo

# Puertos publicados en el host
API_PORT=3000
WEB_PORT=5173
MAILPIT_PORT=8025
```

Genera secretos con `openssl rand -hex 64`. No subas `.env` al repositorio (ya está en `.gitignore`).

---

## Solución de problemas

| Problema | Solución |
|----------|----------|
| Puerto 3000 o 5173 ocupado | Cambia `API_PORT` o `WEB_PORT` en `.env`. |
| Quiero conectarme a PostgreSQL desde el host | PostgreSQL y Redis no publican puertos para no chocar con instalaciones locales. Descomenta `ports` en el servicio `db` (usa `5433:5432`). |
| El video falla con "Sign in to confirm…" o error 429 | YouTube limita las peticiones. Espera y usa **Reintentar**, o sube el SRT/VTT desde la lección. |
| `yt-dlp` deja de funcionar | Reconstruye la imagen para obtener la última versión: `docker compose build --no-cache api worker`. |
| El botón **Escuchar** de un texto está desactivado | El navegador no tiene voces para ese idioma. En Linux instala `speech-dispatcher` con una voz (p. ej. `espeak-ng`) o usa Chrome/Edge con voces en línea; en Android/iOS instala la voz en los ajustes del sistema. |
| No se marca la palabra que se dice en un video | Solo se marca si el video tiene subtítulos automáticos de YouTube (traen el tiempo de cada palabra). Con subtítulos manuales se resalta la frase. |
| La voz del texto solo resalta la frase | Esa voz no avisa de en qué palabra está. Prueba con otra voz del menú de ajustes de reproducción (las locales suelen hacerlo). |
| No aparecen sugerencias de traducción | MyMemory tiene un límite diario por IP. Define `DEEPL_API_KEY` o escribe el significado a mano. |
| Los cambios del frontend no se recargan | En algunos sistemas los volúmenes no emiten eventos: añade `CHOKIDAR_USEPOLLING=true` al servicio `web`. |

---

## Roadmap

**Fase 1 - Base**
- [x] Docker Compose con Rails, React, PostgreSQL, Redis y Sidekiq
- [x] Autenticación con JWT y gestión de idiomas
- [x] Importar texto pegado, URL de artículo y archivos TXT/SRT/VTT
- [x] Lector con palabras clicables, panel de traducción y frases
- [x] Guardar LingQs y estados de palabra

**Fase 2 - YouTube**
- [x] Importar video por URL con metadatos
- [x] Job de Sidekiq para extraer y limpiar subtítulos
- [x] Reproductor IFrame con frase activa resaltada
- [x] Clic para saltar, repetir frase, bucle y velocidad
- [x] Subida manual de SRT/VTT como plan B

**Fase 3 - Repaso**
- [x] Flashcards con SM-2 y modo escritura
- [x] Estadísticas, metas diarias y rachas
- [x] Exportar a CSV y Anki
- [ ] Ejercicios de opción múltiple y dictado
- [ ] FSRS como alternativa a SM-2

**Fase 4 - Extras**
- [ ] Importar PDF, EPUB y podcasts (RSS) con audio sincronizado
- [ ] OAuth con Google
- [ ] Respaldo con Whisper para videos sin subtítulos
- [ ] Soporte para chino, japonés y coreano (requiere segmentación de palabras)
- [x] Extensión de navegador para importar videos de YouTube (usa la sesión de la web) y flag para apagar yt-dlp
- [x] Panel de administración: ajustes, usuarios e idiomas
- [ ] Importar desde Netflix con la extensión
- [ ] Extensión: importar páginas web y artículos
- [ ] PWA y modo offline
- [ ] Traducción y explicaciones gramaticales con IA
- [ ] Tests end-to-end con Playwright
- [ ] Configuración de producción (imágenes optimizadas, build estático del frontend, CI/CD)

---

## Consideraciones legales

- Los videos se reproducen **solo con el reproductor oficial incrustado** de YouTube, controlado con su IFrame Player API; no se descargan ni se redistribuyen. Los controles propios (repetir frase, bucle, velocidad) solo llaman a esa API y van **debajo** del reproductor, nunca encima.
- Se cumplen las reglas de incrustación: el reproductor mide siempre al menos 200×200 px, conserva los controles y la marca de YouTube, y nada se superpone a él (en móvil horizontal el video va en su propia columna; el panel de palabra se limita al espacio libre bajo el reproductor). No se reproduce solo el audio.
- Respeta los [Términos de Servicio de YouTube](https://www.youtube.com/t/terms) y la política de su API.
- Las transcripciones y los artículos pertenecen a sus autores: úsalos para el estudio personal y no los publiques como contenido propio.
- La importación de artículos bloquea direcciones de red privadas para evitar SSRF, pero si despliegas el proyecto públicamente revisa también límites de uso.
- **Extensión del navegador:** obtiene los subtítulos llamando, desde tu navegador, a la API interna del reproductor de YouTube con el cliente de Android (como el importador de LingQ). Evita que el servidor haga scraping, pero **no es una vía aprobada por YouTube**: es la misma técnica que `yt-dlp` y sus términos restringen el acceso automatizado. Úsala para estudio personal.
- **Subtítulos y metadatos con `yt-dlp`:** es la parte que no es oficial. Puedes apagarla con `YTDLP_ENABLED=false`. La API oficial de YouTube solo permite descargar los subtítulos de videos de los que eres propietario, así que para videos ajenos no hay alternativa oficial. Obtenerlos con `yt-dlp` puede chocar con los Términos de Servicio de YouTube; úsalo solo para estudio personal y revisa este punto antes de desplegar el proyecto públicamente. La subida manual de SRT/VTT no depende de YouTube.
- `yt-dlp` puede dejar de funcionar si YouTube cambia su sitio: actualiza la imagen con regularidad y mantén la subida manual de subtítulos como alternativa.

## Licencia

MIT.
