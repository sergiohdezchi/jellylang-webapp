class Lingq < ApplicationRecord
  belongs_to :user
  belongs_to :word
  belongs_to :language
  belongs_to :lesson, optional: true
  belongs_to :segment, optional: true
  has_many :review_logs, dependent: :delete_all

  validates :meaning, length: { maximum: 2000 }
  validates :notes, length: { maximum: 5000 }

  before_validation { self.next_review_at ||= Time.current }

  def user_word
    @user_word ||= UserWord.find_by(user_id: user_id, word_id: word_id)
  end

  def as_json(*)
    {
      id: id,
      term: word.term,
      meaning: meaning,
      notes: notes,
      context: context,
      is_phrase: is_phrase,
      video_time: video_time,
      lesson_id: lesson_id,
      lesson_title: lesson&.title,
      youtube_id: lesson&.youtube_id,
      status: user_word&.status || "learning",
      level: user_word&.level || 1,
      next_review_at: next_review_at,
      interval: interval,
      created_at: created_at
    }
  end
end
