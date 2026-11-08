module Api
  module V1
    class StatsController < ApplicationController
      def show
        render json: Stats::Summary.call(user: current_user, language: language_param)
      end

      # El lector informa de las palabras leídas y el tiempo de escucha.
      def activity
        DailyStat.track!(
          user: current_user,
          language: language_param,
          words_read: params[:words_read].to_i.clamp(0, 10_000),
          listening_seconds: params[:listening_seconds].to_i.clamp(0, 3_600)
        )
        head :no_content
      end
    end
  end
end
