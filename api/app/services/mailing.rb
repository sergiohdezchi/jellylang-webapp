# Configuración del correo saliente. Todo viene de variables de entorno (ver .env.production.example).
#
#   Producción: Zoho Mail (SMTP_ADDRESS=smtp.zoho.com + usuario y contraseña).
#   Desarrollo: Mailpit (docker-compose.yml), que recoge los correos y los muestra en http://localhost:8025.
module Mailing
  module_function

  # Zoho Mail: smtp.zoho.com (EE. UU.), smtp.zoho.eu, smtp.zoho.in, smtp.zoho.com.au, smtp.zoho.jp, smtp.zohocloud.ca.
  # Debe ser el de la región donde se creó la cuenta de Zoho.
  def smtp_address = ENV["SMTP_ADDRESS"].to_s.strip
  def smtp_port = ENV.fetch("SMTP_PORT", "587").to_i
  def smtp_username = ENV["SMTP_USERNAME"].to_s.strip
  def smtp_password = ENV["SMTP_PASSWORD"].to_s

  # En producción hace falta usuario y contraseña; en desarrollo basta el servidor (Mailpit no pide credenciales).
  def smtp_configured?
    smtp_address.present? && (smtp_username.present? || !Rails.env.production?)
  end

  # Zoho solo deja enviar desde la propia cuenta (o uno de sus alias), así que ese es el remitente por defecto.
  def from
    ENV["MAIL_FROM"].presence || (smtp_username.include?("@") ? "Jellylang <#{smtp_username}>" : "Jellylang <no-reply@jellylang.com>")
  end

  # Dirección pública de la web, para los enlaces e imágenes del correo
  def app_url = ENV.fetch("APP_URL", "http://localhost:5173").chomp("/")

  # Sin correo en producción no se envía nada (ni se pide verificar el email). En desarrollo, sin Mailpit, se guarda en tmp/mails.
  def enabled? = Rails.env.test? || Rails.env.development? || smtp_configured?

  def smtp_settings
    port = smtp_port
    settings = {
      address: smtp_address,
      port: port,
      # 587 = STARTTLS, 465 = SSL directo
      enable_starttls_auto: port != 465,
      ssl: port == 465,
      open_timeout: 10,
      read_timeout: 15
    }
    return settings if smtp_username.blank?

    settings.merge(user_name: smtp_username, password: smtp_password, authentication: :login)
  end
end
