# LinguaQ

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

Usuario de demostración: **demo@linguaq.dev / password123** (con una lección de ejemplo en inglés).

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
9. [Variables de entorno](#variables-de-entorno)
10. [Solución de problemas](#solución-de-problemas)
11. [Roadmap](#roadmap)
12. [Consideraciones legales](#consideraciones-legales)

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
- Importar lecciones desde **YouTube**, **texto pegado**, **URL de artículo** y **archivos** TXT, SRT o VTT.
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
- Video arriba (móvil) o a la izquierda (escritorio) y transcripción con la **frase activa resaltada** y auto-scroll.
- Clic en el tiempo de una frase para reproducir desde ahí; frase anterior/siguiente, repetir y **bucle de frase**.
- Velocidad de 0.5× a 2×; pausa automática al abrir una palabra (opcional).
- Cada LingQ guarda el momento del video: desde el vocabulario o el repaso puedes volver a esa frase (`?t=segundos`).

### Vocabulario y repaso
- Lista de LingQs con búsqueda, filtros por nivel y tipo (palabra/frase) y edición en línea del significado.
- Exportación a **CSV** y a **Anki** (TSV con anverso, reverso con contexto y etiquetas).
- Repaso con **SM-2** (Otra vez / Difícil / Bien / Fácil) mostrando el próximo intervalo de cada botón.
- Dos modos: **tarjetas** y **escritura** (escribes la palabra a partir del significado y el contexto).

### Progreso
- Palabras conocidas, LingQs, racha diaria, palabras leídas, horas de escucha y repasos pendientes.
- Meta diaria de LingQs nuevos por idioma y gráfico de los últimos 7 días.
- Las estadísticas usan la zona horaria del navegador (cabecera `X-Timezone`).

### Cuentas e idiomas
- Registro e inicio de sesión con email.
- Varios idiomas de estudio por usuario, cada uno con su meta diaria.
- Idiomas incluidos: inglés, español, francés, alemán, italiano, portugués, neerlandés y ruso.
- Interfaz en español e inglés.

---

## Cómo funciona

### Importación de YouTube

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

El frontend consulta el estado cada 2 segundos mientras la lección está en `processing`.

Limpieza de subtítulos ([parser.rb](api/app/services/subtitles/parser.rb), [builder.rb](api/app/services/subtitles/builder.rb)):
- Elimina etiquetas HTML, marcas de tiempo internas y anotaciones como `[Música]` o `♪`.
- Quita las líneas repetidas en cascada de los subtítulos automáticos.
- Une fragmentos en frases completas (corta por puntuación final, 200 caracteres, 12 segundos o pausas largas) conservando `start` y `end`.

### Sincronización del lector

[useActiveSegment.ts](web/src/hooks/useActiveSegment.ts) consulta `player.getCurrentTime()` cada 200 ms y busca el segmento activo con búsqueda binaria ([segments.ts](web/src/lib/segments.ts)). En los silencios entre frases mantiene resaltada la última que empezó.

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
languages(code, name)
users(email, password_digest, name, ui_language, native_language, current_language_id)
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
| POST | `/auth/signup` | Registro (devuelve JWT) |
| POST | `/auth/login` | Login (devuelve JWT) |
| GET | `/auth/me` | Usuario actual |
| PATCH | `/auth/me` | Perfil, idiomas de estudio, metas e idioma actual |
| GET | `/languages` | Idiomas disponibles |
| GET, POST, PATCH, DELETE | `/courses` | Cursos |
| GET | `/lessons` | Listar lecciones (`language_id`, `course_id`, `level`, `q`) |
| POST | `/lessons` | Crear lección: `source_type` = `text` (`content`), `url` (`url`) o `file` (multipart) |
| POST | `/lessons/youtube` | Importar desde YouTube (respuesta 202) |
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
│   └── Dockerfile
├── web/                                # React
│   ├── src/
│   │   ├── api/                        # cliente fetch y tipos
│   │   ├── auth/                       # contexto de sesión
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   ├── Reader/                 # TextReader, VideoReader, SegmentText
│   │   │   └── WordPanel/
│   │   ├── hooks/                      # useYouTubePlayer, useActiveSegment, useVocabulary…
│   │   ├── i18n/                       # mensajes es/en
│   │   ├── lib/                        # tokenize, segments, format (+ tests)
│   │   ├── pages/
│   │   └── styles/                     # variables, mixins, estilos globales
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
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

---

## Variables de entorno

`.env.example`:

```env
# Base de datos (el host y Redis los fija docker-compose.yml)
DB_USER=linguaq
DB_PASSWORD=linguaq

# Rails
RAILS_ENV=development
SECRET_KEY_BASE=cambia-esto-por-una-cadena-larga-y-aleatoria
JWT_SECRET=cambia-esto-tambien
CORS_ORIGINS=http://localhost:5173

# Traducción: con DEEPL_API_KEY se usa DeepL; vacío = MyMemory (gratis, sin clave)
DEEPL_API_KEY=

# Puertos publicados en el host
API_PORT=3000
WEB_PORT=5173
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
- [ ] Extensión de navegador para importar páginas
- [ ] PWA y modo offline
- [ ] Traducción y explicaciones gramaticales con IA
- [ ] Tests end-to-end con Playwright
- [ ] Configuración de producción (imágenes optimizadas, build estático del frontend, CI/CD)

---

## Consideraciones legales

- Los videos se reproducen **solo con el reproductor oficial incrustado** de YouTube; no se descargan ni se redistribuyen.
- Respeta los [Términos de Servicio de YouTube](https://www.youtube.com/t/terms) y la política de su API.
- Las transcripciones y los artículos pertenecen a sus autores: úsalos para el estudio personal y no los publiques como contenido propio.
- La importación de artículos bloquea direcciones de red privadas para evitar SSRF, pero si despliegas el proyecto públicamente revisa también límites de uso.
- `yt-dlp` puede dejar de funcionar si YouTube cambia su sitio: actualiza la imagen con regularidad y mantén la subida manual de subtítulos como alternativa.

## Licencia

MIT.
