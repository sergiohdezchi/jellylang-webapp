class Course < ApplicationRecord
  belongs_to :user
  belongs_to :language
  has_many :lessons, dependent: :nullify

  validates :title, presence: true, length: { maximum: 200 }

  def as_json(*)
    {
      id: id,
      title: title,
      description: description,
      language_id: language_id,
      lessons_count: lessons.size
    }
  end
end
