class Language < ApplicationRecord
  has_many :lessons
  has_many :words

  # Código ISO 639 en minúsculas (en, es, pt…); el tokenizador asume escrituras con espacios entre palabras
  validates :code, presence: true, uniqueness: true, format: { with: /\A[a-z]{2,3}\z/ }
  validates :name, presence: true, length: { maximum: 60 }

  scope :enabled, -> { where(enabled: true) }

  normalizes :code, with: ->(code) { code.to_s.strip.downcase }
  normalizes :name, with: ->(name) { name.to_s.strip }

  def as_json(*)
    { id: id, code: code, name: name }
  end
end
