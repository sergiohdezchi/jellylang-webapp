module Api
  module V1
    class AuthController < ApplicationController
      include ActionController::Cookies

      # Cookie con el token de sesión, solo para que la extensión del navegador pueda usar la sesión de la web.
      # La API NO la acepta para autenticar (sigue exigiendo "Authorization: Bearer"), así que no abre la puerta a CSRF.
      SESSION_COOKIE = "jellylang_token".freeze

      skip_before_action :authenticate!, only: %i[signup login destroy_session]

      def signup
        unless Features.signups_enabled?
          raise ApiError.new(I18n.t("errors.signups_disabled"), status: :forbidden, code: "signups_disabled")
        end

        user = User.new(params.permit(:email, :password, :name, :ui_language, :native_language))
        User.transaction do
          user.save!
          if (language = Language.enabled.find_by(id: params[:study_language_id]))
            user.user_languages.create!(language: language)
            user.update!(current_language: language)
          end
        end
        token = JsonWebToken.encode(user.id)
        remember_session(token)
        render json: { token: token, user: user }, status: :created
      end

      def login
        user = User.find_by("lower(email) = ?", params[:email].to_s.strip.downcase)
        if user&.authenticate(params[:password].to_s)
          return render_error(I18n.t("errors.account_disabled"), :forbidden, code: "account_disabled") if user.disabled?

          token = JsonWebToken.encode(user.id)
          remember_session(token)
          render json: { token: token, user: user }
        else
          render_error(I18n.t("errors.invalid_credentials"), :unauthorized)
        end
      end

      # También renueva la cookie: así las sesiones abiertas antes de existir la extensión la obtienen al recargar la web
      def me
        remember_session(request.authorization.to_s[/\ABearer (.+)\z/, 1])
        render json: current_user
      end

      # Cerrar sesión en la web borra la cookie, y con ella el acceso de la extensión
      def destroy_session
        cookies.delete(SESSION_COOKIE, same_site: :lax)
        head :no_content
      end

      # Actualiza perfil, idioma actual e idiomas de estudio con su meta diaria.
      def update
        User.transaction do
          current_user.update!(params.permit(:name, :ui_language, :native_language))

          if params.key?(:study_languages)
            sync_study_languages(params.require(:study_languages))
          end

          if params[:current_language_id].present?
            language = Language.find(params[:current_language_id])
            ensure_language_available!(current_user.user_languages.find_or_initialize_by(language: language))
            current_user.user_languages.find_or_create_by!(language: language)
            current_user.update!(current_language: language)
          end
        end
        render json: current_user.reload
      end

      private

      def remember_session(token)
        return if token.blank?

        cookies[SESSION_COOKIE] = {
          value: token,
          httponly: true,
          same_site: :lax,
          secure: Rails.env.production?,
          expires: JsonWebToken::TTL.from_now
        }
      end

      # Un idioma desactivado por el administrador no se puede empezar a estudiar (quien ya lo tenía lo conserva)
      def ensure_language_available!(user_language)
        return unless user_language.new_record? && !user_language.language.enabled?

        raise ApiError, I18n.t("errors.language_disabled", language: user_language.language.name)
      end

      def sync_study_languages(list)
        entries = Array(list).map { |item| item.permit(:language_id, :daily_goal) }
        ids = entries.map { |e| e[:language_id].to_i }
        raise ApiError, I18n.t("errors.need_language") if ids.empty?

        current_user.user_languages.where.not(language_id: ids).delete_all
        entries.each do |entry|
          record = current_user.user_languages.find_or_initialize_by(language: Language.find(entry[:language_id]))
          ensure_language_available!(record)
          record.daily_goal = entry[:daily_goal].presence || record.daily_goal
          record.save!
        end
        unless ids.include?(current_user.current_language_id)
          current_user.update!(current_language_id: ids.first)
        end
      end
    end
  end
end
