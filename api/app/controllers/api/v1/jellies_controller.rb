require "csv"

module Api
  module V1
    class JelliesController < ApplicationController
      PER_PAGE = 50

      def index
        scope = filtered_scope
        page = [params[:page].to_i, 1].max
        total = scope.count
        items = scope.includes(:word, :lesson).order(created_at: :desc).offset((page - 1) * PER_PAGE).limit(PER_PAGE).to_a
        preload_user_words(items)
        render json: { items: items, total: total, page: page, per_page: PER_PAGE }
      end

      # Crea (o actualiza) un Jelly y marca la palabra como "aprendiendo".
      def create
        language = language_param
        word = Word.fetch!(language, params.require(:term))
        jelly = current_user.jellies.find_or_initialize_by(word: word)
        created = jelly.new_record?

        Jelly.transaction do
          jelly.assign_attributes(params.permit(:meaning, :notes, :context, :video_time, :lesson_id, :segment_id))
          jelly.lesson_id = nil if jelly.lesson_id && !current_user.lessons.exists?(jelly.lesson_id)
          jelly.segment_id = nil unless jelly.lesson_id && Segment.exists?(id: jelly.segment_id, lesson_id: jelly.lesson_id)
          jelly.language = language
          jelly.is_phrase = word.term.include?(" ")
          jelly.save!

          user_word = current_user.user_words.find_or_initialize_by(word: word)
          if user_word.new_record? || user_word.status != "learning"
            user_word.update!(status: "learning", level: 1)
          end
        end

        DailyStat.track!(user: current_user, language: language, new_jellies: 1) if created
        render json: { jelly: jelly, entry: Vocabulary::Lookup.entry_for(user: current_user, word: word) },
               status: created ? :created : :ok
      rescue ArgumentError => e
        render_error(e.message)
      end

      def update
        jelly = current_user.jellies.find(params[:id])
        Jelly.transaction do
          jelly.update!(params.permit(:meaning, :notes))
          if params[:level].present?
            level = params[:level].to_i.clamp(1, 4)
            current_user.user_words.find_or_initialize_by(word_id: jelly.word_id).update!(status: "learning", level: level)
          end
        end
        render json: { jelly: jelly.reload, entry: Vocabulary::Lookup.entry_for(user: current_user, word: jelly.word) }
      end

      # Al borrar un Jelly la palabra vuelve a ser "nueva".
      def destroy
        jelly = current_user.jellies.find(params[:id])
        Jelly.transaction do
          current_user.user_words.where(word_id: jelly.word_id).delete_all
          jelly.destroy!
        end
        render json: { entry: Vocabulary::Lookup.entry(jelly.word.term, "new", 0, nil, nil) }
      end

      # CSV completo o TSV listo para importar en Anki (anverso, reverso, etiquetas).
      def export
        items = filtered_scope.includes(:word, :lesson).order(created_at: :asc).limit(20_000).to_a
        preload_user_words(items)
        anki = params[:format_type] == "anki"

        data = CSV.generate(col_sep: anki ? "\t" : ",") do |csv|
          if anki
            items.each do |l|
              back = l.meaning.to_s
              back += "<br><i>#{ERB::Util.html_escape(l.context)}</i>" if l.context.present?
              csv << [l.word.term, back, "jellylang level#{l.user_word&.level || 1}"]
            end
          else
            csv << %w[term meaning notes context status level lesson created_at]
            items.each do |l|
              csv << [l.word.term, l.meaning, l.notes, l.context, l.user_word&.status, l.user_word&.level, l.lesson&.title, l.created_at.to_date]
            end
          end
        end

        send_data data,
                  type: anki ? "text/tab-separated-values" : "text/csv",
                  filename: "jellylang-#{language_param.code}-#{Date.current}.#{anki ? 'txt' : 'csv'}"
      end

      private

      def filtered_scope
        scope = current_user.jellies.where(language: language_param)
        scope = scope.joins(:word).where("words.term ILIKE :q OR jellies.meaning ILIKE :q", q: "%#{Jelly.sanitize_sql_like(params[:q])}%") if params[:q].present?
        scope = scope.where(is_phrase: params[:kind] == "phrase") if params[:kind].present?
        if params[:level].present?
          join = "INNER JOIN user_words uwf ON uwf.word_id = jellies.word_id AND uwf.user_id = jellies.user_id"
          scope = if params[:level] == "known"
                    scope.joins(join).where("uwf.status = 'known'")
                  else
                    scope.joins(join).where("uwf.status = 'learning' AND uwf.level = ?", params[:level].to_i)
                  end
        end
        scope
      end

      def preload_user_words(jellies)
        by_word = current_user.user_words.where(word_id: jellies.map(&:word_id)).index_by(&:word_id)
        jellies.each { |l| l.instance_variable_set(:@user_word, by_word[l.word_id]) }
      end
    end
  end
end
