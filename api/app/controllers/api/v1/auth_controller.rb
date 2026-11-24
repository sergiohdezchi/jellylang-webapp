module Api
  module V1
    class AuthController < ApplicationController
      include ActionController::Cookies

      # Cookie con el token de sesión, solo para que la extensión del navegador pueda usar la sesión de la web.
      # La API NO la acepta para autenticar (sigue exigiendo "Authorization: Bearer"), así que no abre la puerta a CSRF.
      SESSION_COOKIE = "jellylang_token".freeze

      skip_before_action :authenticate!, only: %i[signup login verify_email resend_code forgot_password reset_password destroy_session]

      # Frena la fuerza bruta por IP (se cuenta en Redis). Aparte, cada código admite pocos intentos
      # y al agotarlos la cuenta queda bloqueada un rato (EmailVerifiable::LOCKOUT).
      rate_limit to: 10, within: 5.minutes, only: :login, name: "login", with: -> { too_many_requests(5) }
      rate_limit to: 5, within: 10.minutes, only: :signup, name: "signup", with: -> { too_many_requests(10) }
      rate_limit to: 10, within: 10.minutes, only: :verify_email, name: "verify", with: -> { too_many_requests(10) }
      rate_limit to: 5, within: 10.minutes, only: :resend_code, name: "resend", with: -> { too_many_requests(10) }
      rate_limit to: 5, within: 10.minutes, only: :forgot_password, name: "forgot", with: -> { too_many_requests(10) }
      rate_limit to: 10, within: 10.minutes, only: :reset_password, name: "reset", with: -> { too_many_requests(10) }

      # La cuenta queda pendiente hasta que se introduce el código enviado por email: no hay registros sin correo.
      def signup
        unless Features.signups_enabled?
          raise ApiError.new(I18n.t("errors.signups_disabled"), status: :forbidden, code: "signups_disabled")
        end
        unless Mailing.enabled?
          raise ApiError.new(I18n.t("errors.mail_unavailable"), status: :service_unavailable, code: "mail_unavailable")
        end

        # Quien repite el registro de un email sin verificar lo sobrescribe: un registro abandonado no bloquea el email.
        # Es seguro porque para verificar hace falta el código y también la contraseña vigente.
        email = params[:email].to_s.strip.downcase
        user = User.unverified.find_by("lower(email) = ?", email) || User.new
        user.assign_attributes(params.permit(:email, :password, :name, :ui_language, :native_language))

        User.transaction do
          user.save!
          user.user_languages.delete_all
          if (language = Language.enabled.find_by(id: params[:study_language_id]))
            user.user_languages.create!(language: language)
            user.update!(current_language: language)
          end
        end

        send_code(user, :verification)
        render json: code_pending(user, :verification), status: :accepted
      end

      def login
        user = authenticate_credentials!
        unless user.email_verified?
          # Si no tiene un código vigente, se le envía uno: así puede terminar el registro desde el login
          send_code(user, :verification) unless user.code_active?(:verification)
          return render json: { error: I18n.t("errors.email_not_verified"), code: "email_not_verified", **code_pending(user, :verification) },
                        status: :forbidden
        end

        render_session(user)
      end

      # Termina el registro: email + contraseña + código
      def verify_email
        user = authenticate_credentials!
        return render_session(user) if user.email_verified?

        result = user.verify_email_code!(params[:code])
        if result == :ok
          send_welcome_email(user)
          render_session(user)
        else
          render_code_failure(user, :verification, result)
        end
      end

      def resend_code
        user = authenticate_credentials!
        return render_session(user) if user.email_verified?
        return render_locked(user, :verification) if user.code_locked_for(:verification).positive?

        if (wait = user.code_resend_in(:verification)).positive?
          return render json: { error: I18n.t("errors.verification.wait", count: wait), code: "resend_cooldown", resend_in: wait },
                        status: :too_many_requests
        end

        send_code(user, :verification)
        render json: code_pending(user, :verification), status: :accepted
      end

      # Recuperar la contraseña, paso 1: se envía un código al email. Responde igual exista o no la cuenta
      # (no revela qué emails están registrados).
      def forgot_password
        email = params[:email].to_s.strip.downcase
        raise ApiError.new(I18n.t("errors.mail_unavailable"), status: :service_unavailable, code: "mail_unavailable") unless Mailing.enabled?

        user = User.find_by("lower(email) = ?", email)
        send_code(user, :reset) if user && !user.disabled?
        render json: { email: email, resend_in: EmailVerifiable::RESEND_COOLDOWN.to_i }, status: :accepted
      end

      # Paso 2: email + código + contraseña nueva. Cierra las sesiones anteriores e inicia una nueva.
      def reset_password
        user = User.find_by("lower(email) = ?", params[:email].to_s.strip.downcase)
        return render_error(I18n.t("errors.verification.invalid_generic"), :unprocessable_entity, code: "invalid_code") if user.nil? || user.disabled?

        # La contraseña nueva se valida antes de gastar el código: si es débil, puede corregirla con el mismo código
        probe = User.new(email: user.email, password: params[:password].to_s, ui_language: user.ui_language, native_language: user.native_language)
        probe.validate
        raise ActiveRecord::RecordInvalid, probe if probe.errors.include?(:password) || params[:password].blank?

        result = user.check_code!(:reset, params[:code])
        return render_code_failure(user, :reset, result) unless result == :ok

        user.update!(password: params[:password], password_changed_at: Time.current)
        user.update_columns(email_verified_at: user.email_verified_at || Time.current) # recibir el código prueba que el email es suyo
        render_session(user)
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

      # Mensaje genérico: no revela si el email existe
      def authenticate_credentials!
        user = User.find_by("lower(email) = ?", params[:email].to_s.strip.downcase)
        raise ApiError.new(I18n.t("errors.invalid_credentials"), status: :unauthorized) unless user&.authenticate(params[:password].to_s)
        raise ApiError.new(I18n.t("errors.account_disabled"), status: :forbidden, code: "account_disabled") if user.disabled?

        user
      end

      def render_session(user, status: :ok)
        token = JsonWebToken.encode(user.id)
        remember_session(token)
        render json: { token: token, user: user }, status: status
      end

      def code_pending(user, purpose)
        { verification_required: true, email: user.email, resend_in: [user.code_resend_in(purpose), EmailVerifiable::RESEND_COOLDOWN.to_i].min }
      end

      # Respeta el bloqueo y la espera entre envíos: repetir el registro o el login no inunda el buzón
      def send_code(user, purpose)
        return if user.code_locked_for(purpose).positive? || user.code_resend_in(purpose).positive?

        user.request_code!(purpose)
        (purpose == :reset ? SendPasswordResetCodeJob : SendVerificationCodeJob).perform_async(user.id)
      end

      def render_code_failure(user, purpose, result)
        case result
        when :invalid
          left = user.code_attempts_left(purpose)
          render json: { error: I18n.t("errors.verification.invalid", count: left), code: "invalid_code", attempts_left: left },
                 status: :unprocessable_entity
        when :expired
          render_error(I18n.t("errors.verification.expired"), :unprocessable_entity, code: "code_expired")
        else # :locked, :too_many_attempts
          render_locked(user, purpose)
        end
      end

      # Demasiados intentos: hay que esperar a que termine el bloqueo
      def render_locked(user, purpose)
        seconds = user.code_locked_for(purpose)
        render json: { error: I18n.t("errors.verification.locked", count: (seconds / 60.0).ceil), code: "locked", retry_in: seconds },
               status: :too_many_requests
      end

      # Va a la cola de Sidekiq: si el correo falla, el registro ya está hecho
      def send_welcome_email(user)
        SendWelcomeEmailJob.perform_async(user.id) if Mailing.enabled?
      rescue StandardError => e
        Rails.logger.error("[mail] no se pudo encolar la bienvenida de #{user.id}: #{e.class}: #{e.message}")
      end

      def too_many_requests(minutes)
        render json: { error: I18n.t("errors.rate_limited", count: minutes), code: "rate_limited", retry_in: minutes * 60 },
               status: :too_many_requests
      end

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
