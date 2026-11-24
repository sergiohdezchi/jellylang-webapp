class ApplicationController < ActionController::API
  class ApiError < StandardError
    attr_reader :status, :code

    def initialize(message, status: :unprocessable_entity, code: nil)
      super(message)
      @status = status
      @code = code
    end
  end

  before_action :authenticate!
  around_action :with_user_context

  rescue_from ApiError, with: ->(e) { render_error(e.message, e.status, code: e.code) }
  rescue_from ActiveRecord::RecordNotFound, with: ->(_) { render_error(I18n.t("errors.not_found"), :not_found) }
  rescue_from ActionController::ParameterMissing, with: ->(e) { render_error(e.message, :bad_request) }
  rescue_from ActiveRecord::RecordInvalid do |e|
    render json: { error: e.record.errors.full_messages.to_sentence, details: e.record.errors.to_hash }, status: :unprocessable_entity
  end

  attr_reader :current_user

  private

  def authenticate!
    token = request.authorization.to_s[/\ABearer (.+)\z/, 1]
    payload = token && JsonWebToken.decode(token)
    @current_user = payload && User.find_by(id: payload["sub"])
    @current_user = nil if @current_user&.disabled? # una cuenta desactivada pierde sus sesiones al momento
    # Restablecer la contraseña cierra las sesiones anteriores
    @current_user = nil if @current_user&.password_changed_at && payload["iat"].to_i < @current_user.password_changed_at.to_i
    render_error(I18n.t("errors.unauthorized"), :unauthorized) unless @current_user
  end

  # Usa la zona horaria del navegador (para rachas y estadísticas diarias)
  # y el idioma de interfaz del usuario para los mensajes.
  def with_user_context(&)
    zone = ActiveSupport::TimeZone[request.headers["X-Timezone"].to_s] || Time.zone
    locale = current_user&.ui_language || http_locale
    Time.use_zone(zone) { I18n.with_locale(locale, &) }
  end

  def http_locale
    request.headers["Accept-Language"].to_s.start_with?("en") ? :en : :es
  end

  def render_error(message, status = :unprocessable_entity, code: nil)
    render json: { error: message, code: code }.compact, status: status
  end

  def language_param
    @language_param ||= Language.find(params.require(:language_id))
  end
end
