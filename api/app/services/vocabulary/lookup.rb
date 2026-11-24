module Vocabulary
  # Estado de las palabras de un usuario: { "term" => { status:, level:, jelly_id:, meaning: } }
  # Las palabras ausentes del resultado son "new".
  module Lookup
    module_function

    def call(user:, language:, terms:)
      return {} if terms.empty?

      Word.where(language_id: language.id, term: terms)
          .joins(sanitize("INNER JOIN user_words uw ON uw.word_id = words.id AND uw.user_id = ?", user.id))
          .joins(sanitize("LEFT JOIN jellies l ON l.word_id = words.id AND l.user_id = ?", user.id))
          .pluck("words.term", "uw.status", "uw.level", "l.id", "l.meaning")
          .to_h { |term, status, level, jelly_id, meaning| [term, entry(term, status, level, jelly_id, meaning)] }
    end

    def entry_for(user:, word:)
      call(user: user, language: word.language, terms: [word.term])[word.term] ||
        entry(word.term, "new", 0, nil, nil)
    end

    def entry(term, status, level, jelly_id, meaning)
      { term: term, status: status, level: level, jelly_id: jelly_id, meaning: meaning }
    end

    # Frases guardadas por el usuario que aparecen en el texto dado.
    def phrases(user:, language:, text:)
      haystack = " #{Text::Tokenizer.words(text).map { |w| Text::Tokenizer.normalize(w) }.join(' ')} "
      user.jellies.where(language: language, is_phrase: true).includes(:word).filter_map do |jelly|
        next unless haystack.include?(" #{jelly.word.term} ")

        level = jelly.user_word&.level || 1
        { term: jelly.word.term, jelly_id: jelly.id, meaning: jelly.meaning, level: level, status: jelly.user_word&.status || "learning" }
      end
    end

    def sanitize(sql, *values)
      ActiveRecord::Base.sanitize_sql_array([sql, *values])
    end
  end
end
