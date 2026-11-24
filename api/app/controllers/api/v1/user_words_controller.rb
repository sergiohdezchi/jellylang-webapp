module Api
  module V1
    class UserWordsController < ApplicationController
      STATUSES = %w[new learning known ignored].freeze
      MAX_BULK = 5000

      # PUT /user_words { language_id, term, status, level }
      def upsert
        status = params.require(:status)
        raise ApiError, I18n.t("errors.invalid_status") unless STATUSES.include?(status)

        language = language_param
        word = Word.fetch!(language, params.require(:term))
        user_word = current_user.user_words.find_or_initialize_by(word: word)
        previous = user_word.persisted? ? user_word.status : "new"

        Jelly.transaction do
          case status
          when "new"
            user_word.destroy! if user_word.persisted?
            current_user.jellies.where(word: word).delete_all
          when "learning"
            user_word.update!(status: "learning", level: params[:level].to_i.clamp(1, 4))
            current_user.jellies.find_or_create_by!(word: word) do |jelly|
              jelly.language = language
              jelly.is_phrase = word.term.include?(" ")
            end
          else
            user_word.update!(status: status, level: user_word.level || 1)
          end
        end

        DailyStat.track!(user: current_user, language: language, known_words: 1) if status == "known" && previous != "known"
        render json: { entry: Vocabulary::Lookup.entry_for(user: current_user, word: word) }
      rescue ArgumentError => e
        render_error(e.message)
      end

      # POST /user_words/bulk { language_id, terms: [] }
      # Marca como conocidas las palabras que todavía son nuevas (no toca Jellies ni ignoradas).
      def bulk
        language = language_param
        terms = Array(params.require(:terms)).map { |t| Text::Tokenizer.normalize(t) }.reject(&:empty?).uniq.first(MAX_BULK)
        return render(json: { terms: [] }) if terms.empty?

        now = Time.current
        Word.insert_all(terms.map { |t| { language_id: language.id, term: t, created_at: now, updated_at: now } },
                        unique_by: %i[language_id term])
        words = Word.where(language_id: language.id, term: terms).pluck(:id, :term).to_h
        existing = current_user.user_words.where(word_id: words.keys).pluck(:word_id)
        new_ids = words.keys - existing

        if new_ids.any?
          UserWord.insert_all(new_ids.map { |id| { user_id: current_user.id, word_id: id, status: "known", level: 1, created_at: now, updated_at: now } },
                              unique_by: %i[user_id word_id])
          DailyStat.track!(user: current_user, language: language, known_words: new_ids.size)
        end

        render json: { terms: new_ids.map { |id| words[id] } }
      end
    end
  end
end
