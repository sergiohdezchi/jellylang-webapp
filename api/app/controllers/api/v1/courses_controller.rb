module Api
  module V1
    class CoursesController < ApplicationController
      def index
        courses = current_user.courses.includes(:lessons).order(:title)
        courses = courses.where(language_id: params[:language_id]) if params[:language_id].present?
        render json: courses
      end

      def create
        course = current_user.courses.create!(course_params.merge(language: language_param))
        render json: course, status: :created
      end

      def update
        course = current_user.courses.find(params[:id])
        course.update!(course_params)
        render json: course
      end

      def destroy
        current_user.courses.find(params[:id]).destroy!
        head :no_content
      end

      private

      def course_params
        params.permit(:title, :description)
      end
    end
  end
end
