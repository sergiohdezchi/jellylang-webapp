class DailyStat < ApplicationRecord
  COUNTERS = %i[words_read listening_seconds new_lingqs known_words reviews].freeze

  belongs_to :user
  belongs_to :language

  # Suma contadores de forma atómica al registro del día actual.
  def self.track!(user:, language:, **counters)
    counters = counters.slice(*COUNTERS).transform_values(&:to_i).select { |_, v| v.positive? }
    return if counters.empty?

    keys = { user_id: user.id, language_id: language.id, date: Time.zone.today }
    insert(keys, unique_by: %i[user_id language_id date])
    where(keys).update_counters(counters)
  end

  def active?
    COUNTERS.any? { |c| public_send(c).positive? }
  end
end
