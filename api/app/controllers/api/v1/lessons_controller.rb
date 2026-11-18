module Api
  module V1
    class LessonsController < ApplicationController
      before_action :require_ytdlp!, only: %i[youtube reimport]

      def index
        lessons = current_user.lessons.recent.limit(500)
        lessons = lessons.where(language_id: params[:language_id]) if params[:language_id].present?
        lessons = lessons.where(course_id: params[:course_id]) if params[:course_id].present?
        lessons = lessons.where(status: params[:status]) if params[:status].present?
        lessons = lessons.where(level: params[:level]) if params[:level].present?
        lessons = lessons.where("title ILIKE ?", "%#{Lesson.sanitize_sql_like(params[:q])}%") if params[:q].present?
        render json: lessons.map(&:summary_json)
      end

      def show
        lesson = current_user.lessons.includes(:segments, :language).find(params[:id])
        lesson.update_column(:last_opened_at, Time.current) if lesson.ready?

        text = lesson.segments.map(&:text).join(" ")
        terms = Text::Tokenizer.terms(text)

        render json: lesson.summary_json.merge(
          subtitle_source: lesson.subtitle_source,
          segments: lesson.segments,
          vocabulary: Vocabulary::Lookup.call(user: current_user, language: lesson.language, terms: terms),
          phrases: Vocabulary::Lookup.phrases(user: current_user, language: lesson.language, text: text)
        )
      end

      # Texto pegado, URL de artículo o archivo (multipart).
      def create
        lesson = current_user.lessons.new(base_params.merge(language: language_param))
        rows =
          case params[:source_type]
          when "url" then from_url(lesson)
          when "file" then from_file(lesson)
          else
            lesson.source_type = "text"
            Lessons::Content.from_text(params[:content])
          end

        lesson.title = lesson.title.presence || rows.first&.dig(:text).to_s.truncate(80)
        Lesson.transaction do
          lesson.save!
          lesson.replace_segments!(rows)
        end
        render json: lesson.summary_json, status: :created
      rescue Lessons::Content::Error, Articles::Fetcher::Error => e
        render_error(e.message)
      end

      def youtube
        video_id = Youtube::Url.extract_id(params.require(:url))
        raise ApiError, I18n.t("errors.youtube.invalid_url") unless video_id

        lesson = current_user.lessons.create!(
          base_params.merge(
            language: language_param,
            title: params[:title].presence || "YouTube #{video_id}",
            source_type: "youtube",
            source_url: Youtube::Url.watch_url(video_id),
            youtube_id: video_id,
            thumbnail_url: Youtube::Url.thumbnail_url(video_id),
            status: "processing"
          )
        )
        ImportYoutubeLessonJob.perform_async(lesson.id)
        render json: lesson.summary_json, status: :accepted
      end

      # Reintenta la importación de un video que falló.
      def reimport
        lesson = current_user.lessons.find(params[:id])
        raise ApiError, I18n.t("errors.youtube.not_youtube") unless lesson.youtube?

        lesson.update!(status: "processing", error_message: nil)
        ImportYoutubeLessonJob.perform_async(lesson.id)
        render json: lesson.summary_json, status: :accepted
      end

      # Plan B: subir manualmente un SRT/VTT para la lección.
      def subtitles
        lesson = current_user.lessons.find(params[:id])
        content = params[:file].respond_to?(:read) ? params[:file].read : params.require(:content)
        rows = Lessons::Content.from_subtitles(content)

        Lesson.transaction do
          lesson.replace_segments!(rows)
          lesson.update!(status: "ready", subtitle_source: "upload", error_message: nil)
        end
        render json: lesson.summary_json
      rescue Lessons::Content::Error => e
        render_error(e.message)
      end

      def update
        lesson = current_user.lessons.find(params[:id])
        attrs = params.permit(:title, :level, :course_id, :progress_page)
        attrs[:course_id] = nil if attrs.key?(:course_id) && attrs[:course_id].blank?
        if params.key?(:completed)
          attrs[:completed_at] = ActiveModel::Type::Boolean.new.cast(params[:completed]) ? Time.current : nil
        end
        lesson.update!(attrs)
        render json: lesson.summary_json
      end

      def destroy
        current_user.lessons.find(params[:id]).destroy!
        head :no_content
      end

      private

      # La importación con yt-dlp se puede apagar (YTDLP_ENABLED=false): entonces solo queda la extensión.
      def require_ytdlp!
        return if Features.ytdlp_enabled?

        raise ApiError.new(I18n.t("errors.youtube.ytdlp_disabled"), status: :forbidden, code: "ytdlp_disabled")
      end

      def base_params
        attrs = params.permit(:title, :level, :course_id)
        attrs[:level] = nil if attrs[:level].blank?
        attrs[:course_id] = nil if attrs[:course_id].blank?
        attrs
      end

      def from_url(lesson)
        article = Articles::Fetcher.call(params.require(:url))
        lesson.source_type = "url"
        lesson.source_url = params[:url].strip
        lesson.title = lesson.title.presence || article[:title]
        Lessons::Content.from_text(article[:text])
      end

      def from_file(lesson)
        rows, title = Lessons::Content.from_upload(params.require(:file))
        lesson.source_type = "file"
        lesson.title = lesson.title.presence || title
        rows
      end
    end
  end
end
