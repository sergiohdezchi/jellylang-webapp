module Api
  module V1
    class ReviewsController < ApplicationController
      def due
        limit = params.fetch(:limit, 50).to_i.clamp(1, 200)
        jellies = Stats::Summary.due_reviews(current_user, language_param)
                               .includes(:word, :lesson).order(:next_review_at).limit(limit).to_a

        render json: {
          total: Stats::Summary.due_reviews(current_user, language_param).count,
          items: jellies.map { |jelly| jelly.as_json.merge(intervals: Srs::Scheduler.preview(jelly)) }
        }
      end

      def create
        jelly = current_user.jellies.find(params.require(:jelly_id))
        rating = params.require(:rating).to_i
        raise ApiError, I18n.t("errors.invalid_rating") unless Srs::Scheduler::RATINGS.cover?(rating)

        state = Srs::Scheduler.next_state(interval: jelly.interval, ease: jelly.ease, repetitions: jelly.repetitions, rating: rating)
        Jelly.transaction do
          jelly.update!(state.except(:level_delta))
          user_word = current_user.user_words.find_or_initialize_by(word_id: jelly.word_id)
          level = ((user_word.level || 1) + state[:level_delta]).clamp(1, 4)
          user_word.update!(status: "learning", level: level) unless user_word.status.in?(%w[known ignored])
          current_user.review_logs.create!(jelly: jelly, rating: rating, reviewed_at: Time.current)
        end

        DailyStat.track!(user: current_user, language: jelly.language, reviews: 1)
        render json: jelly.reload
      end
    end
  end
end
