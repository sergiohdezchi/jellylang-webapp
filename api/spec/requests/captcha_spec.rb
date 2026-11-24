require "rails_helper"

RSpec.describe "reCAPTCHA", type: :request do
  let!(:user) { create_user(email: "ana@example.com") }
  let(:verify_url) { "https://www.google.com/recaptcha/api/siteverify" }
  let(:login) { { email: "ana@example.com", password: "Medusa-Azul-2026" } }

  context "sin claves configuradas" do
    it "no lo pide" do
      get "/api/v1/config"
      expect(json["captcha_site_key"]).to be_nil
      post "/api/v1/auth/login", params: login
      expect(response).to have_http_status(:ok)
    end
  end

  context "con claves configuradas" do
    before do
      stub_const("ENV", ENV.to_h.merge("RECAPTCHA_SITE_KEY" => "site", "RECAPTCHA_SECRET_KEY" => "secret"))
    end

    it "publica la clave del sitio, nunca la secreta" do
      get "/api/v1/config"
      expect(json["captcha_site_key"]).to eq("site")
      expect(response.body).not_to include("secret")
    end

    it "rechaza el login, el registro y la recuperación sin token" do
      post "/api/v1/auth/login", params: login
      expect(response).to have_http_status(:unprocessable_content)
      expect(json["code"]).to eq("captcha_failed")

      post "/api/v1/auth/signup", params: login.merge(email: "otra@example.com")
      expect(json["code"]).to eq("captcha_failed")
      expect(User.exists?(email: "otra@example.com")).to eq(false)

      expect { post "/api/v1/auth/forgot_password", params: { email: "ana@example.com" } }.not_to change(SendPasswordResetCodeJob.jobs, :size)
      expect(json["code"]).to eq("captcha_failed")
    end

    it "deja pasar si Google lo confirma" do
      stub = stub_request(:post, verify_url).with(body: hash_including("secret" => "secret", "response" => "token-ok"))
                                           .to_return(body: { success: true }.to_json)
      post "/api/v1/auth/login", params: login.merge(captcha_token: "token-ok")
      expect(response).to have_http_status(:ok)
      expect(stub).to have_been_requested
    end

    it "rechaza si Google lo niega o no responde" do
      stub_request(:post, verify_url).to_return(body: { success: false, "error-codes": ["timeout-or-duplicate"] }.to_json)
      post "/api/v1/auth/login", params: login.merge(captcha_token: "usado")
      expect(response).to have_http_status(:unprocessable_content)

      stub_request(:post, verify_url).to_timeout
      post "/api/v1/auth/login", params: login.merge(captcha_token: "x")
      expect(json["code"]).to eq("captcha_failed")
    end

    it "no se pide en verificar el código ni al restablecer (ya exigen contraseña o código)" do
      post "/api/v1/auth/reset_password", params: { email: "ana@example.com", code: "000000", password: "Nueva-Clave-2026" }
      expect(json["code"]).not_to eq("captcha_failed")
    end
  end
end
