FROM ruby:3.3-slim

ARG UID=1000
ARG GID=1000

RUN apt-get update -qq && apt-get install -y --no-install-recommends \
      build-essential libpq-dev libyaml-dev git curl ca-certificates python3 unzip \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp para subtítulos y metadatos; deno es el runtime JS que yt-dlp
# necesita para resolver algunas peticiones de YouTube.
RUN curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp \
    && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh -s -- -y --no-modify-path

RUN groupadd -g ${GID} app && useradd -m -u ${UID} -g ${GID} app \
    && mkdir -p /rails && chown -R app:app /rails /usr/local/bundle

WORKDIR /rails
USER app

COPY --chown=app:app Gemfile Gemfile.lock ./
RUN bundle install

COPY --chown=app:app . .

ENTRYPOINT ["/rails/bin/docker-entrypoint"]
EXPOSE 3000
CMD ["bin/rails", "server", "-b", "0.0.0.0", "-p", "3000"]
