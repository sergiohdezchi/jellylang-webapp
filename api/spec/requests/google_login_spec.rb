require "rails_helper"

RSpec.describe "Inicio de sesión con Google", type: :request do
  let(:tokeninfo_url) { %r{https://oauth2\.googleapis\.com/tokeninfo} }
  let(:client_id) { "cliente-123.apps.googleusercontent.com" }

  def stub_google(email: "ana@example.com", name: "Ana Ríos", aud: client_id, verified: "true", iss: "https://accounts.google.com")
    stub_request(:get, tokeninfo_url).to_return(
      status: 200, body: { aud: aud, iss: iss, email: email, email_verified: verified, name: name }.to_json
    )
  end

  context "sin GOOGLE_CLIENT_ID" do
    it "no se ofrece ni funciona" do
      get "/api/v1/config"
      expect(json["google_client_id"]).to be_nil
      post "/api/v1/auth/google", params: { credential: "token" }
      expect(response).to have_http_status(:unauthorized)
    end
  end

  context "con GOOGLE_CLIENT_ID" do
    before { stub_const("ENV", ENV.to_h.merge("GOOGLE_CLIENT_ID" => client_id)) }

    it "publica el id de cliente" do
      get "/api/v1/config"
      expect(json["google_client_id"]).to eq(client_id)
    end

    it "entra en la cuenta existente con ese correo" do
      user = create_user(email: "ana@example.com")
      stub_google(email: "Ana@Example.com")

      expect { post "/api/v1/auth/google", params: { credential: "token" } }.not_to change(User, :count)
      expect(response).to have_http_status(:ok)
      expect(json["token"]).to be_present
      expect(json.dig("user", "id")).to eq(user.id)
    end

    it "crea la cuenta verificada si el correo es nuevo" do
      stub_google(email: "nueva@example.com", name: "Nueva Persona")

      expect { post "/api/v1/auth/google", params: { credential: "token", ui_language: "en" } }.to change(User, :count).by(1)
      expect(response).to have_http_status(:ok)
      user = User.find_by!(email: "nueva@example.com")
      expect(user.email_verified?).to eq(true)
      expect(user.name).to eq("Nueva Persona")
      expect(user.ui_language).to eq("en")
    end

    it "no crea cuentas si el registro está cerrado, pero deja entrar a las existentes" do
      create_user(email: "ana@example.com")
      Settings.set("signups_enabled", false)

      stub_google(email: "otra@example.com")
      post "/api/v1/auth/google", params: { credential: "token" }
      expect(response).to have_http_status(:forbidden)
      expect(json["code"]).to eq("signups_disabled")

      stub_google(email: "ana@example.com")
      post "/api/v1/auth/google", params: { credential: "token" }
      expect(response).to have_http_status(:ok)
    end

    it "confirma una cuenta pendiente y descarta la contraseña con la que se registraron" do
      user = create_user(email: "ana@example.com")
      user.update_columns(email_verified_at: nil)
      stub_google(email: "ana@example.com")

      post "/api/v1/auth/google", params: { credential: "token" }
      expect(response).to have_http_status(:ok)
      expect(user.reload.email_verified?).to eq(true)

      post "/api/v1/auth/login", params: { email: "ana@example.com", password: "Medusa-Azul-2026" }
      expect(response).to have_http_status(:unauthorized)
    end

    it "rechaza cuentas desactivadas" do
      create_user(email: "ana@example.com").update_columns(disabled_at: Time.current)
      stub_google(email: "ana@example.com")

      post "/api/v1/auth/google", params: { credential: "token" }
      expect(response).to have_http_status(:forbidden)
      expect(json["code"]).to eq("account_disabled")
    end

    it "rechaza tokens de otra aplicación, sin correo verificado o inválidos" do
      stub_google(aud: "otra-app")
      post "/api/v1/auth/google", params: { credential: "token" }
      expect(response).to have_http_status(:unauthorized)

      stub_google(verified: "false")
      post "/api/v1/auth/google", params: { credential: "token" }
      expect(response).to have_http_status(:unauthorized)

      stub_request(:get, tokeninfo_url).to_return(status: 400, body: { error: "invalid_token" }.to_json)
      post "/api/v1/auth/google", params: { credential: "token" }
      expect(response).to have_http_status(:unauthorized)

      post "/api/v1/auth/google"
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
