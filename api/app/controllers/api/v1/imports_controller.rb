module Api
  module V1
    # Recibe lecciones de fuentes externas. La extensión del navegador es la vía oficial para YouTube:
    # lee los subtítulos que el propio reproductor carga en el navegador del usuario y los envía aquí.
    class ImportsController < ApplicationController
      def create
        lesson, created = Imports::Video.new(user: current_user, language: language_param, params: import_params).call
        render json: { lesson: lesson.summary_json, created: created }, status: created ? :created : :ok
      rescue Imports::Video::Error, Lessons::Content::Error => e
        render_error(e.message)
      end

      private

      def import_params
        params.permit(:source, :course_id, :level, video: %i[id title author duration], track: %i[language kind format content])
      end
    end
  end
end
