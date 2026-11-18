module Lessons
  # Convierte las distintas fuentes de una lección en filas de segmentos.
  module Content
    class Error < StandardError; end

    MAX_TEXT_CHARS = 200_000
    MAX_FILE_BYTES = 2 * 1024 * 1024
    TEXT_EXTENSIONS = %w[.txt .md].freeze
    SUBTITLE_EXTENSIONS = %w[.srt .vtt].freeze

    module_function

    def from_text(text)
      text = text.to_s
      raise Error, I18n.t("errors.lesson.empty") if text.strip.empty?
      raise Error, I18n.t("errors.lesson.too_long", max: MAX_TEXT_CHARS) if text.length > MAX_TEXT_CHARS

      Text::Segmenter.call(text)
    end

    def from_subtitles(content)
      rows = Subtitles::Builder.call(Subtitles::Parser.parse(content))
      raise Error, I18n.t("errors.lesson.empty_subtitles") if rows.empty?

      rows
    end

    def from_json3(content)
      rows = Subtitles::Builder.call(Subtitles::Json3Parser.parse(content))
      raise Error, I18n.t("errors.lesson.empty_subtitles") if rows.empty?

      rows
    rescue Subtitles::Json3Parser::Error => e
      raise Error, e.message
    end

    # Subtítulos de un cliente externo (extensión): formato json3, vtt o srt.
    def from_track(format, content)
      format == "json3" ? from_json3(content) : from_subtitles(content)
    end

    # Devuelve [rows, título sugerido]
    def from_upload(upload)
      raise Error, I18n.t("errors.lesson.empty") unless upload.respond_to?(:read)
      raise Error, I18n.t("errors.lesson.file_too_large") if upload.size > MAX_FILE_BYTES

      name = upload.original_filename.to_s
      extension = File.extname(name).downcase
      content = upload.read.force_encoding(Encoding::UTF_8).scrub("")
      title = File.basename(name, extension).tr("_-", "  ").strip

      rows =
        if TEXT_EXTENSIONS.include?(extension) then from_text(content)
        elsif SUBTITLE_EXTENSIONS.include?(extension) then from_subtitles(content)
        else raise Error, I18n.t("errors.lesson.unsupported_file", extension: extension.presence || "?")
        end

      [rows, title]
    end
  end
end
