require "rails_helper"

RSpec.describe "Recuperar contraseña", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  let!(:user) { create_user(email: "ana@example.com") }
  let(:new_password) { "Nueva-Clave-2026" }

  before { ActionMailer::Base.deliveries.clear }

  def forgot(email = user.email) = post("/api/v1/auth/forgot_password", params: { email: email })

  def reset(code, password: new_password, email: user.email)
    post "/api/v1/auth/reset_password", params: { email: email, code: code, password: password }
  end

  def deliver_code
    SendPasswordResetCodeJob.drain
    ActionMailer::Base.deliveries.last.text_part.body.to_s[/\b\d{6}\b/]
  end

  it "envía un código, cambia la contraseña e inicia sesión" do
    expect { forgot }.to change(SendPasswordResetCodeJob.jobs, :size).by(1)
    expect(response).to have_http_status(:accepted)

    code = deliver_code
    mail = ActionMailer::Base.deliveries.last
    expect(mail.subject).to eq("#{code} es tu código para cambiar la contraseña")
    expect(user.reload.reset_code_digest).not_to include(code)

    reset(code)
    expect(response).to have_http_status(:ok)
    expect(json["token"]).to be_present

    post "/api/v1/auth/login", params: { email: user.email, password: new_password }
    expect(response).to have_http_status(:ok)
    post "/api/v1/auth/login", params: { email: user.email, password: "Medusa-Azul-2026" }
    expect(response).to have_http_status(:unauthorized)
  end

  it "no revela si el email existe" do
    expect { forgot("nadie@example.com") }.not_to change(SendPasswordResetCodeJob.jobs, :size)
    expect(response).to have_http_status(:accepted)
    expect(json["email"]).to eq("nadie@example.com")
  end

  it "el código solo sirve una vez" do
    forgot
    code = deliver_code
    reset(code)
    reset(code, password: "Otra-Clave-2026")
    expect(response).to have_http_status(:unprocessable_content)
    expect(json["code"]).to eq("code_expired")
  end

  it "cierra las sesiones anteriores" do
    old_headers = auth_headers(user)
    get "/api/v1/auth/me", headers: old_headers
    expect(response).to have_http_status(:ok)

    forgot
    travel 2.seconds do
      reset(deliver_code)
      get "/api/v1/auth/me", headers: old_headers
      expect(response).to have_http_status(:unauthorized)
    end
  end

  it "una contraseña débil se rechaza sin gastar el código" do
    forgot
    code = deliver_code
    reset(code, password: "password123")
    expect(response).to have_http_status(:unprocessable_content)
    expect(json.dig("details", "password")).to be_present

    reset(code)
    expect(response).to have_http_status(:ok)
  end

  it "tras 5 códigos erróneos bloquea la recuperación unos minutos" do
    forgot
    code = deliver_code
    wrong = code == "000000" ? "111111" : "000000"
    reset(wrong)
    expect(json).to include("code" => "invalid_code", "attempts_left" => 4)
    4.times { reset(wrong) }
    expect(response).to have_http_status(:too_many_requests)
    expect(json["code"]).to eq("locked")

    reset(code)
    expect(json["code"]).to eq("locked")
    forgot
    expect { SendPasswordResetCodeJob.drain }.not_to change { ActionMailer::Base.deliveries.size }
  end

  it "recuperar la contraseña también verifica un email pendiente" do
    pending_user = User.create!(email: "p@example.com", password: "Medusa-Azul-2026", native_language: "es")
    forgot(pending_user.email)
    reset(deliver_code, email: pending_user.email)
    expect(response).to have_http_status(:ok)
    expect(pending_user.reload.email_verified?).to eq(true)
  end

  it "no funciona para cuentas desactivadas ni sin servidor de correo" do
    user.update!(disabled_at: Time.current)
    expect { forgot }.not_to change(SendPasswordResetCodeJob.jobs, :size)

    allow(Mailing).to receive(:enabled?).and_return(false)
    forgot
    expect(response).to have_http_status(:service_unavailable)
  end
end
