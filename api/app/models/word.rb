class Word < ApplicationRecord
  belongs_to :language
  has_many :user_words, dependent: :delete_all
  has_many :lingqs, dependent: :delete_all

  validates :term, presence: true, length: { maximum: 500 }

  def self.fetch!(language, raw_term)
    term = Text::Tokenizer.normalize(raw_term)
    raise ArgumentError, "Término vacío" if term.blank?

    upsert({ language_id: language.id, term: term }, unique_by: %i[language_id term])
    find_by!(language_id: language.id, term: term)
  end
end
