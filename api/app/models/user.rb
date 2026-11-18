class User < ApplicationRecord
  UI_LANGUAGES = %w[es en].freeze

  has_secure_password

  belongs_to :current_language, class_name: "Language", optional: true
  has_many :user_languages, dependent: :delete_all
  has_many :languages, through: :user_languages
  has_many :courses, dependent: :delete_all
  has_many :lessons, dependent: :destroy
  has_many :user_words, dependent: :delete_all
  has_many :lingqs, dependent: :delete_all
  has_many :review_logs, dependent: :delete_all
  has_many :daily_stats, dependent: :delete_all

  normalizes :email, with: ->(email) { email.strip.downcase }

  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validate :email_not_taken
  validates :password, length: { minimum: 8 }, allow_nil: true
  validates :ui_language, inclusion: { in: UI_LANGUAGES }
  validates :native_language, presence: true

  scope :admins, -> { where(admin: true, disabled_at: nil) }

  def disabled? = disabled_at.present?

  def daily_goal_for(language)
    user_languages.find_by(language: language)&.daily_goal || UserLanguage::DEFAULT_GOAL
  end

  def as_json(*)
    {
      id: id,
      email: email,
      name: name,
      ui_language: ui_language,
      native_language: native_language,
      admin: admin,
      current_language: current_language,
      languages: user_languages.includes(:language).map(&:as_json)
    }
  end

  private

  def email_not_taken
    scope = User.where("lower(email) = ?", email.to_s.downcase)
    scope = scope.where.not(id: id) if persisted?
    errors.add(:email, :taken) if scope.exists?
  end
end
