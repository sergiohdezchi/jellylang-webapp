require "rails_helper"

RSpec.describe "Cookie de sesión para la extensión", type: :request do
  let!(:user) { create_user }

  def session_cookie
    response.headers["Set-Cookie"].to_s.split("\n").find { |c| c.start_with?("linguaq_token=") }
  end

  it "se fija al iniciar sesión, como HttpOnly y SameSite=Lax" do
    post "/api/v1/auth/login", params: { email: user.email, password: "password123" }

    expect(session_cookie).to include("linguaq_token=#{json['token']}")
    expect(session_cookie).to match(/httponly/i)
    expect(session_cookie).to match(/samesite=lax/i)
  end

  it "se fija al registrarse" do
    post "/api/v1/auth/signup", params: { email: "nueva@example.com", password: "password123" }
    expect(session_cookie).to include("linguaq_token=#{json['token']}")
  end

  it "se renueva al consultar el perfil (para sesiones abiertas antes de existir la extensión)" do
    token = JsonWebToken.encode(user.id)
    get "/api/v1/auth/me", headers: { "Authorization" => "Bearer #{token}" }
    expect(session_cookie).to include("linguaq_token=#{token}")
  end

  it "se borra al cerrar sesión, aunque el token ya no sea válido" do
    # El navegador envía la cookie en la petición (la web llama a la API desde el mismo origen)
    delete "/api/v1/auth/session", headers: { "Cookie" => "linguaq_token=caducado" }
    expect(response).to have_http_status(:no_content)
    expect(session_cookie).to match(/linguaq_token=;/)
  end

  it "no sirve para autenticar: la API sigue exigiendo Bearer (sin riesgo de CSRF)" do
    get "/api/v1/auth/me", headers: { "Cookie" => "linguaq_token=#{JsonWebToken.encode(user.id)}" }
    expect(response).to have_http_status(:unauthorized)
  end
end
