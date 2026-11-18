module Imports
  # Crea (o actualiza) una lección de video a partir de subtítulos que envía un cliente de confianza,
  # como la extensión del navegador. Sustituye a la descarga con yt-dlp: el servidor no consulta a YouTube.
  class Video
    class Error < StandardError; end

    SOURCES = %w[youtube].freeze
    FORMATS = %w[json3 vtt srt].freeze
    KINDS = %w[manual asr].freeze
    MAX_CONTENT_BYTES = 5 * 1024 * 1024

    def initialize(user:, language:, params:)
      @user = user
      @language = language
      @params = params
      @video = params[:video] || {}
      @track = params[:track] || {}
    end

    # Devuelve [lección, creada?]
    def call
      source = @params[:source].to_s
      raise Error, I18n.t("errors.import.source_unsupported", source: source) unless SOURCES.include?(source)

      video_id = Youtube::Url.extract_id(@video[:id])
      raise Error, I18n.t("errors.import.invalid_video") unless video_id

      check_language!
      rows = rows_for_track
      kind = KINDS.include?(@track[:kind].to_s) ? @track[:kind].to_s : "manual"

      lesson = @user.lessons.find_or_initialize_by(language: @language, source_type: "youtube", youtube_id: video_id)
      created = lesson.new_record?

      Lesson.transaction do
        lesson.title = @video[:title].to_s.squish.truncate(300).presence || "YouTube #{video_id}" if created || lesson.title.start_with?("YouTube ")
        lesson.assign_attributes(
          source_url: Youtube::Url.watch_url(video_id),
          thumbnail_url: Youtube::Url.thumbnail_url(video_id),
          author: @video[:author].to_s.squish.truncate(200).presence,
          duration: @video[:duration].to_i.positive? ? @video[:duration].to_i : nil,
          subtitle_source: kind == "asr" ? "auto" : "manual",
          status: "ready",
          error_message: nil
        )
        if created
          lesson.level = @params[:level].presence
          lesson.course_id = @params[:course_id].presence
        end
        lesson.save!
        lesson.replace_segments!(rows)
      end

      [lesson, created]
    end

    private

    # Los subtítulos tienen que estar en el idioma de la lección (en-US / en-GB cuentan como "en").
    def check_language!
      track_language = @track[:language].to_s.downcase.split(/[-_]/).first
      return if track_language == @language.code

      raise Error, I18n.t("errors.import.language_mismatch", track: @track[:language].to_s, language: @language.code)
    end

    def rows_for_track
      format = @track[:format].to_s
      content = @track[:content].to_s
      raise Error, I18n.t("errors.import.unsupported_format", name: format) unless FORMATS.include?(format)
      raise Error, I18n.t("errors.import.too_large") if content.bytesize > MAX_CONTENT_BYTES

      Lessons::Content.from_track(format, content)
    end
  end
end
