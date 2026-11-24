module Api
  module V1
    module Admin
      class OverviewController < BaseController
        def show
          today = Time.zone.today
          week = (today - 6)..today

          render json: {
            users: {
              total: User.count,
              admins: User.admins.count,
              disabled: User.where.not(disabled_at: nil).count,
              new_this_week: User.where(created_at: week.first.beginning_of_day..).count,
              active_this_week: DailyStat.where(date: week).where(Stats::Summary::ACTIVE_SQL).distinct.count(:user_id)
            },
            lessons: {
              total: Lesson.count,
              youtube: Lesson.where(source_type: "youtube").count,
              processing: Lesson.where(status: "processing").count,
              failed: Lesson.where(status: "failed").count
            },
            jellies: Jelly.count,
            reviews_this_week: DailyStat.where(date: week).sum(:reviews),
            languages: Language.enabled.count,
            failed_imports: failed_imports
          }
        end

        private

        # Últimas importaciones fallidas (útil para ver si yt-dlp ha dejado de funcionar)
        def failed_imports
          Lesson.where(status: "failed").includes(:user).order(updated_at: :desc).limit(10).map do |lesson|
            {
              id: lesson.id,
              title: lesson.title,
              youtube_id: lesson.youtube_id,
              error_message: lesson.error_message,
              user_email: lesson.user.email,
              updated_at: lesson.updated_at
            }
          end
        end
      end
    end
  end
end
