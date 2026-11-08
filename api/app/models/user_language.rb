class UserLanguage < ApplicationRecord
  DEFAULT_GOAL = 20

  belongs_to :user
  belongs_to :language

  validates :language_id, uniqueness: { scope: :user_id }
  validates :daily_goal, numericality: { only_integer: true, in: 1..500 }

  def as_json(*)
    { language: language, daily_goal: daily_goal }
  end
end
