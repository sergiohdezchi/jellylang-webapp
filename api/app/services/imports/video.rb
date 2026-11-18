module Imports
  # Crea (o actualiza) una lección de video a partir de subtítulos que envía un cliente de confianza,
  # como la extensión del navegador. El servidor no consulta a YouTube: los subtítulos llegan ya descargados.
  class Video
    class Error < StandardError; end

    SOURCES = %w[youtube].freeze
    FORMATS = %w[json3 vtt srt].freeze
    KINDS = %w[manual asr].freeze
    MAX_CONTENT_BYTES = 5 * 1024 * 1024
    # Códigos antiguos que YouTube sigue usando
    LANGUAGE_ALIASES = { "iw" => "he", "in" => "id", "ji" => "yi", "fil" => "tl" }.freeze

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
      course = course_for_params
      kind = KINDS.include?(@track[:kind].to_s) ? @track[:kind].to_s : "manual"

      lesson = @user.lessons.find_or_initialize_by(language: @language, source_type: "youtube", youtube_id: video_id)
      created = lesson.new_record?

      Lesson.transaction do
        # El título que envía el cliente es el que el usuario dejó en el formulario: se aplica también al reimportar
        title = @video[:title].to_s.squish.truncate(300).presence
        lesson.title = title || lesson.title.presence || "YouTube #{video_id}"
        lesson.assign_attributes(
          source_url: Youtube::Url.watch_url(video_id),
          thumbnail_url: Youtube::Url.thumbnail_url(video_id),
          author: @video[:author].to_s.squish.truncate(200).presence,
          duration: @video[:duration].to_i.positive? ? @video[:duration].to_i : nil,
          subtitle_source: kind == "asr" ? "auto" : "manual",
          status: "ready",
          error_message: nil
        )
        # Curso y nivel se aplican si vienen (también al reimportar: son elecciones explícitas)
        lesson.level = @params[:level].presence if @params.key?(:level)
        lesson.course = course if @params.key?(:course_id) || @params.key?(:course_title)
        lesson.save!
        lesson.replace_segments!(rows)
      end

      [lesson, created]
    end

    private

    # Los subtítulos tienen que estar en el idioma de la lección (en-US / en-GB cuentan como "en").
    def check_language!
      track_language = @track[:language].to_s.downcase.split(/[-_]/).first
      track_language = LANGUAGE_ALIASES.fetch(track_language, track_language)
      return if track_language == @language.code

      raise Error, I18n.t("errors.import.language_mismatch", track: @track[:language].to_s, language: @language.code)
    end

    # course_id: un curso propio del idioma de la lección; course_title: lo reutiliza por nombre o lo crea
    def course_for_params
      if (title = @params[:course_title].to_s.squish.presence)
        courses = @user.courses.where(language: @language)
        return courses.find_by("lower(title) = ?", title.downcase) || courses.create!(title: title)
      end
      return if @params[:course_id].blank?

      @user.courses.find_by(id: @params[:course_id], language: @language) || raise(Error, I18n.t("errors.import.invalid_course"))
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
