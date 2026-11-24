module Stats
  module Summary
    ACTIVE_SQL = "words_read + listening_seconds + new_jellies + known_words + reviews > 0".freeze

    module_function

    def call(user:, language:)
      today = Time.zone.today
      range = (today - 6)..today
      by_date = user.daily_stats.where(language: language, date: range).index_by(&:date)
      totals = user.daily_stats.where(language: language)
                   .pick(Arel.sql("COALESCE(SUM(words_read),0)"), Arel.sql("COALESCE(SUM(listening_seconds),0)"))

      {
        language_id: language.id,
        known_words: known_words(user, language),
        jellies: user.jellies.where(language: language).count,
        due_reviews: due_reviews(user, language).count,
        words_read: totals[0].to_i,
        listening_seconds: totals[1].to_i,
        streak: streak(user, today),
        daily_goal: user.daily_goal_for(language),
        today: day_json(today, by_date[today]),
        week: range.map { |date| day_json(date, by_date[date]) }
      }
    end

    def known_words(user, language)
      user.user_words.joins(:word).where(status: "known", words: { language_id: language.id }).count
    end

    def due_reviews(user, language, now: Time.current)
      user.jellies.where(language: language)
          .joins("INNER JOIN user_words ON user_words.word_id = jellies.word_id AND user_words.user_id = jellies.user_id")
          .where(user_words: { status: "learning" })
          .where(jellies: { next_review_at: ..now })
    end

    # Días consecutivos con actividad. Hoy cuenta si ya hubo actividad;
    # si aún no, la racha sigue viva desde ayer.
    def streak(user, today)
      dates = user.daily_stats.where(ACTIVE_SQL).where(date: ..today)
                  .distinct.order(date: :desc).limit(1000).pluck(:date)
      return 0 if dates.empty?

      expected = dates.first == today ? today : today - 1
      dates.take_while.with_index { |date, index| date == expected - index }.size
    end

    def day_json(date, stat)
      counters = DailyStat::COUNTERS.to_h { |c| [c, stat&.public_send(c) || 0] }
      { date: date, **counters }
    end
  end
end
