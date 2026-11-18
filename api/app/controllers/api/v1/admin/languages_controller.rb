module Api
  module V1
    module Admin
      class LanguagesController < BaseController
        def index
          languages = Language.select(
            "languages.*",
            "(SELECT COUNT(*) FROM user_languages WHERE user_languages.language_id = languages.id) AS users_count",
            "(SELECT COUNT(*) FROM lessons WHERE lessons.language_id = languages.id) AS lessons_count"
          ).order(:name)
          render json: languages.map { |language| language_json(language) }
        end

        def create
          language = Language.create!(params.permit(:code, :name, :enabled))
          render json: language_json(language), status: :created
        end

        # El código no se cambia: está en las URLs de diccionarios, en la voz y en los subtítulos importados
        def update
          language = Language.find(params[:id])
          language.update!(params.permit(:name, :enabled))
          render json: language_json(language)
        end

        # Solo si nadie lo usa; si no, hay que desactivarlo
        def destroy
          language = Language.find(params[:id])
          if in_use?(language)
            raise ApiError.new(I18n.t("errors.admin.language_in_use"), code: "language_in_use")
          end

          Language.transaction do
            Word.where(language_id: language.id).delete_all # vocabulario huérfano de cuentas ya borradas
            language.destroy!
          end
          head :no_content
        end

        private

        def in_use?(language)
          [UserLanguage, Lesson, Course, Lingq, DailyStat].any? { |model| model.where(language_id: language.id).exists? } ||
            User.where(current_language_id: language.id).exists?
        end

        def language_json(language)
          {
            id: language.id,
            code: language.code,
            name: language.name,
            enabled: language.enabled,
            users_count: language.try(:users_count).to_i,
            lessons_count: language.try(:lessons_count).to_i
          }
        end
      end
    end
  end
end
