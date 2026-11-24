require "net/http"

# Google reCAPTCHA v2 («No soy un robot»). Se activa definiendo RECAPTCHA_SITE_KEY y RECAPTCHA_SECRET_KEY;
# sin ellas no se pide (en desarrollo, docker-compose usa las claves de prueba de Google, que siempre aprueban).
module Captcha
  VERIFY_URL = URI("https://www.google.com/recaptcha/api/siteverify").freeze

  module_function

  def site_key = ENV["RECAPTCHA_SITE_KEY"].to_s.strip
  def secret_key = ENV["RECAPTCHA_SECRET_KEY"].to_s.strip
  def enabled? = site_key.present? && secret_key.present?

  # true si Google confirma el token. Cada token sirve una sola vez. Si Google no responde, se rechaza.
  def verify?(token, ip: nil)
    return true unless enabled?
    return false if token.blank?

    response = Net::HTTP.start(VERIFY_URL.host, VERIFY_URL.port, use_ssl: true, open_timeout: 5, read_timeout: 5) do |http|
      http.post(VERIFY_URL.path, URI.encode_www_form(secret: secret_key, response: token.to_s, remoteip: ip.to_s.presence).to_s,
                "Content-Type" => "application/x-www-form-urlencoded")
    end
    JSON.parse(response.body)["success"] == true
  rescue StandardError => e
    Rails.logger.error("[captcha] no se pudo verificar: #{e.class}: #{e.message}")
    false
  end
end
