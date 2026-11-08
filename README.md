# LinguaQ (proyecto estilo LingQ)

Aplicación web para aprender idiomas mediante **lectura y escucha de contenido real**: textos, artículos, podcasts y videos de YouTube. El usuario lee, toca las palabras desconocidas, las guarda como "LingQs" y las repasa con repetición espaciada.

> Nombre provisional: `LinguaQ`. Cámbialo por el que prefieras.

## Stack

| Capa | Tecnología |
|------|------------|
| Contenedores | **Docker** + Docker Compose |
| Frontend | **React** + TypeScript + Vite |
| Estilos | **SCSS** (módulos) |
| Backend | **Ruby on Rails 8** (modo API) |
| Base de datos | **PostgreSQL** 16 |
| Caché y colas | **Redis** 7 + Sidekiq |
| Video | YouTube IFrame Player API |
| Subtítulos y metadatos | `yt-dlp` dentro del contenedor del backend |
| Autenticación | `has_secure_password` + JWT |
| Tests | RSpec (backend), Vitest + Playwright (frontend) |

## Índice

1. [Características](#características)
2. [Importación de videos de YouTube](#importación-de-videos-de-youtube)
3. [Lector sincronizado con el video](#lector-sincronizado-con-el-video)
4. [Arquitectura](#arquitectura)
5. [Modelo de datos](#modelo-de-datos)
6. [API REST](#api-rest)
7. [Estructura del proyecto](#estructura-del-proyecto)
8. [Docker](#docker)
9. [Puesta en marcha](#puesta-en-marcha)
10. [Variables de entorno](#variables-de-entorno)
11. [Roadmap](#roadmap)
12. [Consideraciones legales](#consideraciones-legales)

---

## Características

### Biblioteca de contenido
- Importar lecciones desde **texto pegado**, **URL de artículo**, **archivos** (TXT, PDF, EPUB, SRT/VTT), **podcasts (RSS)** y **YouTube**.
- Organización en cursos, colecciones y etiquetas; filtros por idioma, nivel y estado.
- Lecciones divididas en páginas para una lectura cómoda.

### Lectura interactiva
- Cada palabra es clicable y abre un panel con traducción y diccionario.
- Codificación por colores según el conocimiento de la palabra:
    - Azul: palabra nueva.
    - Amarillo: palabra guardada (LingQ) con nivel 1 a 4.
    - Sin color: palabra conocida.
- Guardar frases completas como LingQ, con su contexto.
- Marcar palabras como conocidas o ignoradas (nombres propios, números).
- Marcar toda la página como conocida al avanzar.

### Vocabulario y repaso
- Lista de LingQs con búsqueda y filtros; exportación a CSV y Anki.
- Flashcards con repetición espaciada (SM-2 o FSRS).
- Ejercicios: opción múltiple, escritura y dictado.
- Cada palabra conserva su frase de origen y, si viene de un video, el momento exacto.

### Audio y video
- Velocidad variable, repetir frase y saltar 5 segundos.
- Texto sincronizado con el audio o el video.

### Progreso
- Palabras conocidas, palabras leídas, tiempo de escucha y racha diaria.
- Metas diarias y gráficos semanales.

### Cuentas e idiomas
- Registro e inicio de sesión (email y OAuth con Google).
- Varios idiomas de estudio por usuario.
- Interfaz en español e inglés (i18n).

### Ideas futuras
- Extensión de navegador para importar páginas.
- Soporte para chino, japonés y coreano.
- Traducción y explicaciones gramaticales con IA.
- Modo offline (PWA).

---

## Importación de videos de YouTube

Flujo del usuario:

1. Pega una URL de YouTube (`youtube.com/watch?v=...` o `youtu.be/...`).
2. La API valida la URL, extrae el ID del video y crea una lección en estado `processing`.
3. Un job de **Sidekiq** obtiene los metadatos y los subtítulos con `yt-dlp`.
4. El job limpia el texto, lo divide en frases con tiempos y lo guarda como `segments`.
5. La lección pasa a `ready` y el frontend la abre en el lector con el video incrustado.

El frontend consulta el estado de la lección (polling cada 2 segundos o ActionCable sobre Redis) hasta que está lista.

### Fuentes de la transcripción (por prioridad)

| Prioridad | Fuente | Notas |
|-----------|--------|-------|
| 1 | Subtítulos manuales | Mejor calidad |
| 2 | Subtítulos automáticos de YouTube | Pueden tener errores y poca puntuación |
| 3 | Transcripción con Whisper | Respaldo si el video no tiene subtítulos (opcional) |
| 4 | Subida manual de SRT/VTT | Último recurso |

### Procesamiento del texto

- Descargar solo los subtítulos, sin el video (`--skip-download`).
- Eliminar duplicados típicos de los subtítulos automáticos (líneas que se repiten en cascada).
- Quitar etiquetas como `[Música]` o `[Aplausos]`.
- Unir fragmentos cortos en frases completas, conservando `start` y `end`.
- Tokenizar palabras y vincularlas con el vocabulario del usuario.

### Ejemplo del servicio (Ruby)

```ruby
# app/services/youtube/fetch_subtitles.rb
require "open3"
require "json"

module Youtube
    class FetchSubtitles
        class Error < StandardError; end

        def initialize(video_id:, language:)
            @video_id = video_id
            @language = language
        end

        def call
            Dir.mktmpdir do |dir|
                run_ytdlp(dir)
                file = Dir.glob(File.join(dir, "*.vtt")).first
                raise Error, "El video no tiene subtítulos en #{@language}" unless file

                VttParser.new(File.read(file)).segments
            end
        end

        private

        def run_ytdlp(dir)
            _out, err, status = Open3.capture3(
                "yt-dlp",
                "--skip-download",
                "--write-subs",
                "--write-auto-subs",
                "--sub-langs", @language,
                "--sub-format", "vtt",
                "-o", File.join(dir, "%(id)s"),
                "https://www.youtube.com/watch?v=#{@video_id}"
            )

            raise Error, err unless status.success?
        end
    end
end
```

```ruby
# app/jobs/import_youtube_lesson_job.rb
class ImportYoutubeLessonJob
    include Sidekiq::Job
    sidekiq_options queue: :imports, retry: 3

    def perform(lesson_id)
        lesson = Lesson.find(lesson_id)
        segments = Youtube::FetchSubtitles.new(
            video_id: lesson.youtube_id,
            language: lesson.language.code
        ).call

        Lesson.transaction do
            lesson.segments.insert_all(
                segments.each_with_index.map do |seg, index|
                    seg.merge(lesson_id: lesson.id, position: index)
                end
            )
            lesson.update!(status: :ready)
        end
    rescue Youtube::FetchSubtitles::Error => e
        lesson.update!(status: :failed, error_message: e.message)
    end
end
```

---

## Lector sincronizado con el video

El objetivo es **leer el texto mientras el video se reproduce**, con la frase actual resaltada.

### Cómo funciona

1. El video se muestra con la **YouTube IFrame Player API**; no se descarga ni se aloja.
2. Un temporizador consulta `player.getCurrentTime()` cada ~200 ms.
3. Se busca el segmento activo con búsqueda binaria sobre `start` y `end`.
4. Se resalta la frase y se hace auto-scroll para mantenerla visible.
5. Al hacer clic en una frase, se llama a `player.seekTo(start)`.

### Funciones

- Resaltado de la frase activa.
- Clic en una frase para reproducirla desde ahí.
- Repetir frase y bucle de frase.
- Velocidad de 0.5x a 2x.
- Pausa automática al abrir una palabra (opcional).
- Auto-scroll activable y desactivable.
- Diseño responsive: video arriba y texto abajo en móvil; lado a lado en escritorio.

### Hook de sincronización (React + TypeScript)

```tsx
// apps/web/src/hooks/useActiveSegment.ts
import { useEffect, useRef, useState } from "react";

export interface Segment {
    id: number;
    position: number;
    text: string;
    start: number;
    end: number;
}

export function findActiveSegment(segments: Segment[], time: number): number {
    let low = 0;
    let high = segments.length - 1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const segment = segments[mid];

        if (time < segment.start) {
            high = mid - 1;
        } else if (time >= segment.end) {
            low = mid + 1;
        } else {
            return mid;
        }
    }

    return -1;
}

export function useActiveSegment(
    player: YT.Player | null,
    segments: Segment[]
) {
    const [activeIndex, setActiveIndex] = useState(-1);
    const lastIndex = useRef(-1);

    useEffect(() => {
        if (!player) return;

        const timer = window.setInterval(() => {
            const index = findActiveSegment(segments, player.getCurrentTime());

            if (index !== lastIndex.current) {
                lastIndex.current = index;
                setActiveIndex(index);
            }
        }, 200);

        return () => window.clearInterval(timer);
    }, [player, segments]);

    return activeIndex;
}
```

### Estilos (SCSS)

```scss
$color-active: #fff3b0;
$color-new: #cfe3ff;
$color-saved: #ffe08a;

.reader {
    display: grid;
    grid-template-columns: 480px 1fr;
    gap: 24px;

    @media (max-width: 900px) {
        grid-template-columns: 1fr;
    }
}

.segment {
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 150ms ease;

    &.is-active {
        background-color: $color-active;
    }

    .word {
        &.is-new {
            background-color: $color-new;
        }

        &.is-saved {
            background-color: $color-saved;
        }
    }
}
```

---

## Arquitectura

```
                    ┌─────────────────────┐
                    │  web (React + Vite) │
                    └───────┬─────────────┘
          IFrame API │      │ REST / JSON
      ┌──────────────┘      ▼
┌───────────┐       ┌─────────────────────┐       ┌──────────────┐
│  YouTube  │       │   api (Rails API)   │ ────► │  PostgreSQL  │
└───────────┘       └───────┬─────────────┘       └──────────────┘
                            │ encola jobs
                            ▼
                    ┌─────────────────────┐       ┌──────────────┐
                    │  worker (Sidekiq)   │ ────► │    Redis     │
                    │  yt-dlp, parseo     │       │ colas + caché│
                    └─────────────────────┘       └──────────────┘
```

---

## Modelo de datos

```
users(id, email, password_digest, ui_language)
languages(id, code, name)
user_languages(user_id, language_id, daily_goal)

courses(id, user_id, language_id, title)
lessons(id, course_id, title, source_type, source_url, youtube_id,
        audio_url, level, status, error_message)
segments(id, lesson_id, position, text, start, end)

words(id, language_id, term, lemma)
user_words(id, user_id, word_id, status, level)
lingqs(id, user_id, word_id, lesson_id, segment_id, meaning, notes,
       is_phrase, next_review_at, interval, ease)

review_logs(id, user_id, lingq_id, rating, reviewed_at)
daily_stats(id, user_id, date, words_read, minutes, new_words)
```

- `lessons.status`: `processing | ready | failed`
- `user_words.status`: `new | learning | known | ignored`
- Índices recomendados: `segments(lesson_id, position)`, `words(language_id, term)` único, `lingqs(user_id, next_review_at)`.

---

## API REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/auth/signup` | Registro |
| POST | `/api/v1/auth/login` | Login (devuelve JWT) |
| GET | `/api/v1/lessons` | Listar lecciones |
| POST | `/api/v1/lessons` | Crear lección (texto, URL) |
| POST | `/api/v1/lessons/youtube` | Importar desde YouTube |
| GET | `/api/v1/lessons/:id` | Lección con estado |
| GET | `/api/v1/lessons/:id/segments` | Segmentos con tiempos |
| POST | `/api/v1/lingqs` | Guardar palabra o frase |
| PATCH | `/api/v1/user_words/:id` | Cambiar estado de una palabra |
| GET | `/api/v1/reviews/due` | Tarjetas pendientes de repaso |
| POST | `/api/v1/reviews` | Registrar resultado de repaso |
| GET | `/api/v1/stats` | Estadísticas |

---

## Estructura del proyecto

```
linguaq/
├── api/                         # Rails API
│   ├── app/
│   │   ├── controllers/api/v1/
│   │   ├── models/
│   │   ├── jobs/
│   │   ├── services/youtube/
│   │   └── serializers/
│   ├── config/
│   ├── db/
│   ├── spec/
│   ├── Dockerfile
│   └── Gemfile
├── web/                         # React
│   ├── src/
│   │   ├── components/
│   │   │   ├── Reader/
│   │   │   ├── VideoPlayer/
│   │   │   └── WordPanel/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── styles/              # SCSS: variables, mixins, base
│   │   └── api/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## Docker

### `docker-compose.yml`

```yaml
services:
    db:
        image: postgres:16-alpine
        environment:
            POSTGRES_USER: linguaq
            POSTGRES_PASSWORD: linguaq
            POSTGRES_DB: linguaq_development
        volumes:
            - postgres_data:/var/lib/postgresql/data
        ports:
            - "5432:5432"
        healthcheck:
            test: ["CMD-SHELL", "pg_isready -U linguaq"]
            interval: 5s
            retries: 10

    redis:
        image: redis:7-alpine
        volumes:
            - redis_data:/data
        ports:
            - "6379:6379"
        healthcheck:
            test: ["CMD", "redis-cli", "ping"]
            interval: 5s
            retries: 10

    api:
        build: ./api
        command: bin/rails server -b 0.0.0.0 -p 3000
        env_file: .env
        volumes:
            - ./api:/rails
            - bundle_cache:/usr/local/bundle
        ports:
            - "3000:3000"
        depends_on:
            db:
                condition: service_healthy
            redis:
                condition: service_healthy

    worker:
        build: ./api
        command: bundle exec sidekiq -C config/sidekiq.yml
        env_file: .env
        volumes:
            - ./api:/rails
            - bundle_cache:/usr/local/bundle
        depends_on:
            - api

    web:
        build: ./web
        command: npm run dev -- --host 0.0.0.0
        env_file: .env
        volumes:
            - ./web:/app
            - /app/node_modules
        ports:
            - "5173:5173"
        depends_on:
            - api

volumes:
    postgres_data:
    redis_data:
    bundle_cache:
```

### `api/Dockerfile`

```dockerfile
FROM ruby:3.3-slim

RUN apt-get update -qq && apt-get install -y --no-install-recommends \
    build-essential libpq-dev libyaml-dev git curl python3 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp para obtener subtítulos y metadatos
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /rails

COPY Gemfile Gemfile.lock ./
RUN bundle install

COPY . .

EXPOSE 3000
```

### `web/Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173
```

---

## Puesta en marcha

Requisitos: **Docker** y **Docker Compose**. No necesitas instalar Ruby, Node ni PostgreSQL en tu máquina.

```bash
# 1. Crear la carpeta del proyecto
mkdir linguaq && cd linguaq
git init

# 2. Generar la API de Rails (una sola vez, usando Docker)
docker run --rm -v "$PWD":/work -w /work ruby:3.3 bash -c \
    "gem install rails && rails new api --api --database=postgresql --skip-test --skip-git"

# 3. Generar el frontend de React (una sola vez)
docker run --rm -v "$PWD":/work -w /work node:20-alpine \
    npm create vite@latest web -- --template react-ts

# 4. Agregar gems y paquetes
#    api/Gemfile  -> sidekiq, redis, jwt, bcrypt, rack-cors, rspec-rails
#    web          -> sass, react-router-dom, @tanstack/react-query

# 5. Crear los archivos de la sección Docker y copiar .env.example a .env
cp .env.example .env

# 6. Construir y levantar todo
docker compose up --build

# 7. Preparar la base de datos
docker compose exec api bin/rails db:create db:migrate db:seed
```

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| API | http://localhost:3000 |
| Panel de Sidekiq | http://localhost:3000/sidekiq (solo desarrollo) |

Comandos útiles:

```bash
docker compose logs -f api worker     # ver logs
docker compose exec api bundle exec rspec   # tests del backend
docker compose exec web npm test      # tests del frontend
docker compose exec api bin/rails console
docker compose down -v                # apagar y borrar datos
```

---

## Variables de entorno

`.env.example`:

```env
# Base de datos y Redis
DATABASE_URL=postgresql://linguaq:linguaq@db:5432/linguaq_development
REDIS_URL=redis://redis:6379/0

# Rails
RAILS_ENV=development
SECRET_KEY_BASE=cambia-esto
JWT_SECRET=cambia-esto
CORS_ORIGINS=http://localhost:5173

# Servicios externos (opcionales)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
TRANSLATE_API_KEY=
OPENAI_API_KEY=

# Frontend
VITE_API_URL=http://localhost:3000/api/v1
```

> No subas `.env` al repositorio. Agrégalo a `.gitignore`.

---

## Roadmap

**Fase 1 - Base**
- [ ] Docker Compose con Rails, React, PostgreSQL, Redis y Sidekiq
- [ ] Autenticación con JWT y gestión de idiomas
- [ ] Importar texto pegado y URL
- [ ] Lector con palabras clicables y panel de traducción
- [ ] Guardar LingQs y estados de palabra

**Fase 2 - YouTube**
- [ ] Importar video por URL con metadatos
- [ ] Job de Sidekiq para extraer y limpiar subtítulos
- [ ] Reproductor IFrame con frase activa resaltada
- [ ] Clic para saltar, repetir frase y velocidad

**Fase 3 - Repaso**
- [ ] Flashcards con SM-2 o FSRS
- [ ] Estadísticas y rachas
- [ ] Exportar a Anki

**Fase 4 - Extras**
- [ ] Respaldo con Whisper para videos sin subtítulos
- [ ] Soporte para CJK
- [ ] Extensión de navegador
- [ ] PWA y modo offline
- [ ] Traducción y gramática con IA
- [ ] Configuración de producción (imagen optimizada, CI/CD)

---

## Consideraciones legales

- Reproduce los videos **solo con el reproductor oficial incrustado** de YouTube; no descargues ni redistribuyas el video.
- Respeta los [Términos de Servicio de YouTube](https://www.youtube.com/t/terms) y la política de la API.
- Las transcripciones pertenecen a sus autores: úsalas para el estudio personal del usuario y no las publiques como contenido propio.
- `yt-dlp` puede dejar de funcionar si YouTube cambia su sitio; actualiza la imagen con regularidad y ten un plan B (subida manual de SRT/VTT).
- LingQ es una marca de sus propietarios; este proyecto es independiente. Usa un nombre y un diseño propios.

---

## Licencia

MIT (o la que elijas).