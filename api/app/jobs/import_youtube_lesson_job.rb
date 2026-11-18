class ImportYoutubeLessonJob
  include Sidekiq::Job
  sidekiq_options queue: :imports, retry: 2

  sidekiq_retries_exhausted do |job, exception|
    Lesson.where(id: job["args"].first, status: "processing")
          .update_all(status: "failed", error_message: exception.message.to_s.truncate(500))
  end

  def perform(lesson_id)
    lesson = Lesson.includes(:language, :user).find_by(id: lesson_id)
    return unless lesson&.status == "processing"

    I18n.with_locale(lesson.user.ui_language) do
      # Si se apagó yt-dlp con trabajos ya en cola, no se consulta a YouTube: la lección queda marcada como fallida.
      if Features.ytdlp_enabled?
        import(lesson)
      else
        lesson.update!(status: "failed", error_message: I18n.t("errors.youtube.ytdlp_disabled"))
      end
    end
  end

  private

  def import(lesson)
    client = Youtube::Client.new(lesson.youtube_id)
    info = client.metadata

    lesson.update!(
      title: lesson.title == placeholder_title(lesson) ? info["title"].to_s.truncate(300).presence || lesson.title : lesson.title,
      author: info["uploader"] || info["channel"],
      duration: info["duration"]&.to_i,
      thumbnail_url: info["thumbnail"].presence || lesson.thumbnail_url
    )

    content, track = client.subtitles(lesson.language.code, info)
    rows = Lessons::Content.from_subtitles(content)

    lesson.replace_segments!(rows)
    lesson.update!(status: "ready", subtitle_source: track[:auto] ? "auto" : "manual", error_message: nil)
  rescue Youtube::Client::Error, Lessons::Content::Error => e
    lesson.update!(status: "failed", error_message: e.message.truncate(500))
  end

  def placeholder_title(lesson)
    "YouTube #{lesson.youtube_id}"
  end
end
