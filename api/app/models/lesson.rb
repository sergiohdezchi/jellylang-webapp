class Lesson < ApplicationRecord
  SOURCE_TYPES = %w[text url file youtube].freeze
  STATUSES = %w[processing ready failed].freeze
  LEVELS = %w[beginner intermediate advanced].freeze

  belongs_to :user
  belongs_to :language
  belongs_to :course, optional: true
  has_many :segments, -> { order(:position) }, dependent: :delete_all, inverse_of: :lesson

  validates :title, presence: true, length: { maximum: 300 }
  validates :source_type, inclusion: { in: SOURCE_TYPES }
  validates :status, inclusion: { in: STATUSES }
  validates :level, inclusion: { in: LEVELS }, allow_nil: true
  validate :course_belongs_to_user

  scope :recent, -> { order(Arel.sql("COALESCE(last_opened_at, created_at) DESC")) }

  def youtube? = source_type == "youtube"
  def ready? = status == "ready"

  # Sustituye los segmentos de la lección y recalcula el número de palabras.
  def replace_segments!(rows)
    transaction do
      segments.delete_all
      if rows.any?
        Segment.insert_all!(
          rows.each_with_index.map do |row, index|
            {
              lesson_id: id,
              position: index,
              paragraph: row[:paragraph] || index,
              text: row[:text],
              start_time: row[:start_time],
              end_time: row[:end_time]
            }
          end
        )
      end
      update!(word_count: rows.sum { |row| Text::Tokenizer.words(row[:text]).size })
    end
  end

  def summary_json
    {
      id: id,
      title: title,
      source_type: source_type,
      source_url: source_url,
      youtube_id: youtube_id,
      thumbnail_url: thumbnail_url,
      author: author,
      duration: duration,
      level: level,
      status: status,
      error_message: error_message,
      word_count: word_count,
      progress_page: progress_page,
      completed_at: completed_at,
      language_id: language_id,
      course_id: course_id,
      created_at: created_at
    }
  end

  private

  def course_belongs_to_user
    return if course.nil? || course.user_id == user_id

    errors.add(:course, :invalid)
  end
end
