class Language < ApplicationRecord
  has_many :lessons
  has_many :words

  validates :code, presence: true, uniqueness: true
  validates :name, presence: true

  def as_json(*)
    { id: id, code: code, name: name }
  end
end
