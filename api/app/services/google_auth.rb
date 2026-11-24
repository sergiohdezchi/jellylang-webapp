require "net/http"

# Inicio de sesión con Google: valida el ID token que entrega el botón de Google Identity Services.
module GoogleAuth
  TOKENINFO_URL = URI("https://oauth2.googleapis.com/tokeninfo").freeze
  ISSUERS = %w[accounts.google.com https://accounts.google.com].freeze

  module_function

  def client_id = ENV["GOOGLE_CLIENT_ID"].to_s.strip
  def enabled? = client_id.present?

  # Devuelve { email:, name: } si Google confirma el token y el correo, o nil si no es válido.
  def verify(credential)
    return nil unless enabled? && credential.present?

    uri = TOKENINFO_URL.dup
    uri.query = URI.encode_www_form(id_token: credential.to_s)
    response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 5, read_timeout: 5) { |http| http.get(uri.request_uri) }
    return nil unless response.is_a?(Net::HTTPSuccess)

    claims = JSON.parse(response.body)
    return nil unless claims["aud"] == client_id && ISSUERS.include?(claims["iss"])
    return nil unless claims["email_verified"].to_s == "true" && claims["email"].present?

    { email: claims["email"].to_s.strip.downcase, name: claims["name"].to_s.strip.presence }
  rescue StandardError => e
    Rails.logger.error("[google] no se pudo verificar: #{e.class}: #{e.message}")
    nil
  end
end
