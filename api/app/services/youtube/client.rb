require "open3"
require "json"
require "tmpdir"

module Youtube
  # Envoltorio de yt-dlp: metadatos y subtítulos, nunca descarga el video.
  class Client
    class Error < StandardError; end

    TIMEOUT_SECONDS = 120

    def initialize(video_id)
      @video_id = video_id
    end

    def metadata
      JSON.parse(run("--dump-single-json", "--skip-download", "--no-playlist"))
    rescue JSON::ParserError
      raise Error, I18n.t("errors.youtube.metadata")
    end

    # Devuelve [contenido, { lang:, auto: }] o lanza Error si no hay pista adecuada.
    def subtitles(language, info)
      track = pick_track(language, info)
      raise Error, I18n.t("errors.youtube.no_subtitles", language: language) unless track

      Dir.mktmpdir do |dir|
        run(
          "--skip-download",
          track[:auto] ? "--write-auto-subs" : "--write-subs",
          "--sub-langs", track[:lang],
          "--sub-format", "vtt/srt/best",
          "-o", File.join(dir, "%(id)s.%(ext)s")
        )
        file = Dir.glob(File.join(dir, "*.{vtt,srt}")).first
        raise Error, I18n.t("errors.youtube.no_subtitles", language: language) unless file

        [File.read(file), track]
      end
    end

    # Prioridad: subtítulos manuales > automáticos en el idioma original del video.
    # Se descartan las traducciones automáticas porque no coinciden con el audio.
    def pick_track(language, info)
      manual = (info["subtitles"] || {}).keys - ["live_chat"]
      if (key = manual.find { |k| k == language } || manual.find { |k| k.start_with?("#{language}-") })
        return { lang: key, auto: false }
      end

      auto = (info["automatic_captions"] || {}).keys
      original = info["language"].to_s
      return { lang: "#{language}-orig", auto: true } if auto.include?("#{language}-orig")
      return { lang: language, auto: true } if auto.include?(language) && original.start_with?(language)

      nil
    end

    private

    def run(*args)
      command = ["timeout", TIMEOUT_SECONDS.to_s, "yt-dlp", "--no-warnings", "--no-progress", *args, Url.watch_url(@video_id)]
      out, err, status = Open3.capture3(*command)
      return out if status.success?

      message = err.lines.grep(/ERROR/).last || err.lines.last || "yt-dlp terminó con código #{status.exitstatus}"
      raise Error, message.strip.sub(/\AERROR:\s*/, "").truncate(400)
    rescue Errno::ENOENT
      raise Error, I18n.t("errors.youtube.ytdlp_missing")
    end
  end
end
