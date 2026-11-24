require "rails_helper"

RSpec.describe "Registro con código por correo", type: :request do
  let!(:language) { Language.find_or_create_by!(code: "en") { |l| l.name = "English" } }
  let(:password) { "Medusa-Azul-2026" }
  let(:email) { "nuevo@example.com" }

  before { ActionMailer::Base.deliveries.clear }

  def signup(**extra)
    post "/api/v1/auth/signup", params: { email: email, password: password, name: "Nuevo", study_language_id: language.id }.merge(extra)
  end

  # Ejecuta los jobs encolados y devuelve el último código enviado
  def deliver_code
    SendVerificationCodeJob.drain
    ActionMailer::Base.deliveries.last.text_part.body.to_s[/\b\d{6}\b/]
  end

  def verify(code, pass: password)
    post "/api/v1/auth/verify_email", params: { email: email, password: pass, code: code }
  end

  def user = User.find_by!(email: email)

  it "deja la cuenta pendiente, envía un código y al verificarlo inicia sesión y da la bienvenida" do
    expect { signup }.to change(SendVerificationCodeJob.jobs, :size).by(1)
    expect(response).to have_http_status(:accepted)
    expect(json).to include("verification_required" => true, "email" => email, "resend_in" => 60)
    expect(json).not_to have_key("token")
    expect(user.email_verified?).to eq(false)

    code = deliver_code
    mail = ActionMailer::Base.deliveries.last
    expect(mail.to).to eq([email])
    expect(mail.subject).to eq("#{code} es tu código de Jellylang")
    expect(mail.html_part.body.to_s).to include(code)
    expect(user.verification_code_digest).not_to include(code) # solo se guarda el HMAC

    expect { verify(code) }.to change(SendWelcomeEmailJob.jobs, :size).by(1)
    expect(response).to have_http_status(:ok)
    expect(json["token"]).to be_present
    expect(json.dig("user", "email_verified")).to eq(true)
    expect(json.dig("user", "current_language", "code")).to eq("en")

    SendWelcomeEmailJob.drain
    welcome = ActionMailer::Base.deliveries.last
    expect(welcome.subject).to start_with("¡Te damos la bienvenida a Jellylang!")
    expect(welcome.html_part.body.to_s).to include("Nuevo").and include(Mailing.app_url)
  end

  it "no deja iniciar sesión sin verificar y reenvía el código si no hay uno vigente" do
    signup
    deliver_code
    user.update_columns(verification_code_sent_at: 20.minutes.ago)

    expect {
      post "/api/v1/auth/login", params: { email: email, password: password }
    }.to change(SendVerificationCodeJob.jobs, :size).by(1)
    expect(response).to have_http_status(:forbidden)
    expect(json).to include("code" => "email_not_verified", "verification_required" => true)

    verify(deliver_code)
    post "/api/v1/auth/login", params: { email: email, password: password }
    expect(response).to have_http_status(:ok)
  end

  it "exige la contraseña para verificar (no basta con el código)" do
    signup
    code = deliver_code
    verify(code, pass: "Otra-Clave-2026")
    expect(response).to have_http_status(:unauthorized)
    expect(user.email_verified?).to eq(false)
  end

  it "tras 5 intentos fallidos bloquea la cuenta y pide esperar, incluso con el código bueno" do
    signup
    code = deliver_code
    wrong = code == "000000" ? "111111" : "000000"

    verify(wrong)
    expect(response).to have_http_status(:unprocessable_content)
    expect(json).to include("code" => "invalid_code", "attempts_left" => 4)

    3.times { verify(wrong) }
    verify(wrong)
    expect(response).to have_http_status(:too_many_requests)
    expect(json).to include("code" => "locked", "retry_in" => be_between(1, 900))
    expect(json["error"]).to include("15 minutos")

    verify(code)
    expect(json["code"]).to eq("locked")
    expect(user.email_verified?).to eq(false)

    # Tampoco se puede esquivar pidiendo otro código
    post "/api/v1/auth/resend_code", params: { email: email, password: password }
    expect(json["code"]).to eq("locked")
    expect { SendVerificationCodeJob.drain }.not_to change { ActionMailer::Base.deliveries.size }

    # Pasado el bloqueo, se puede pedir uno nuevo
    user.update_columns(verification_locked_until: 1.minute.ago, verification_code_sent_at: 2.minutes.ago)
    post "/api/v1/auth/resend_code", params: { email: email, password: password }
    expect(response).to have_http_status(:accepted)
    verify(deliver_code)
    expect(response).to have_http_status(:ok)
  end

  it "rechaza un código caducado" do
    signup
    code = deliver_code
    user.update_columns(verification_code_sent_at: 16.minutes.ago)
    verify(code)
    expect(json["code"]).to eq("code_expired")
  end

  it "reenvía el código respetando la espera entre envíos" do
    signup
    old_code = deliver_code

    post "/api/v1/auth/resend_code", params: { email: email, password: password }
    expect(response).to have_http_status(:too_many_requests)
    expect(json["code"]).to eq("resend_cooldown")

    user.update_columns(verification_code_sent_at: 2.minutes.ago)
    post "/api/v1/auth/resend_code", params: { email: email, password: password }
    expect(response).to have_http_status(:accepted)

    new_code = deliver_code
    verify(old_code) if old_code != new_code
    expect(user.reload.email_verified?).to eq(false) if old_code != new_code
    verify(new_code)
    expect(response).to have_http_status(:ok)
  end

  it "un registro abandonado no bloquea el email: repetirlo sustituye la contraseña" do
    signup(password: "Primera-Clave-2026")
    user.update_columns(verification_code_sent_at: 2.minutes.ago)

    expect { signup }.not_to change(User, :count)
    expect(response).to have_http_status(:accepted)
    verify(deliver_code)
    expect(response).to have_http_status(:ok)
  end

  it "un email ya verificado sigue ocupado" do
    create_user(email: email)
    signup
    expect(response).to have_http_status(:unprocessable_content)
    expect(json.dig("details", "email")).to be_present
  end

  it "el registro funciona aunque Sidekiq no pueda encolar la bienvenida" do
    allow(SendWelcomeEmailJob).to receive(:perform_async).and_raise(RedisClient::CannotConnectError)
    signup
    verify(deliver_code)
    expect(response).to have_http_status(:ok)
  end

  it "no hay registros si el servidor no puede enviar correos" do
    allow(Mailing).to receive(:enabled?).and_return(false)
    signup
    expect(response).to have_http_status(:service_unavailable)
    expect(json["code"]).to eq("mail_unavailable")
    expect(User.exists?(email: email)).to eq(false)

    get "/api/v1/config"
    expect(json["signups_enabled"]).to eq(false)
  end

  it "las cuentas creadas por un administrador ya están verificadas" do
    admin = create_user(email: "admin@example.com").tap { |u| u.update!(admin: true) }
    post "/api/v1/admin/users", params: { email: email, password: password }, headers: auth_headers(admin), as: :json
    expect(user.email_verified?).to eq(true)
  end

  describe "contraseñas" do
    it "rechaza contraseñas débiles al registrarse" do
      signup(password: "password1234")
      expect(response).to have_http_status(:unprocessable_content)
      expect(json.dig("details", "password")).to include(
        "debe incluir una letra mayúscula", "es demasiado común o fácil de adivinar"
      )
      expect(User.exists?(email: email)).to eq(false)
    end

    it "no permite que contenga el email" do
      signup(email: "medusa.azul@example.com", password: "Medusa.Azul-99")
      expect(json.dig("details", "password")).to include("no puede contener tu email")
    end
  end

  describe "envío" do
    it "manda la bienvenida en inglés si la interfaz está en inglés" do
      english = User.create!(email: "bob@example.com", password: password, ui_language: "en", native_language: "en",
                             email_verified_at: Time.current)
      SendWelcomeEmailJob.new.perform(english.id)
      expect(ActionMailer::Base.deliveries.last.subject).to start_with("Welcome to Jellylang!")
    end

    it "no envía a usuarios desactivados, borrados o ya verificados" do
      off = User.create!(email: "off@example.com", password: password, native_language: "es", disabled_at: Time.current)
      verified = create_user(email: "ok@example.com")
      SendWelcomeEmailJob.new.perform(off.id)
      SendWelcomeEmailJob.new.perform(0)
      SendVerificationCodeJob.new.perform(verified.id)
      expect(ActionMailer::Base.deliveries).to be_empty
    end
  end

  describe Mailing do
    def with_env(vars)
      stub_const("ENV", ENV.to_h.except("SMTP_ADDRESS", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD", "MAIL_FROM").merge(vars))
    end

    it "con Zoho usa la cuenta SMTP como remitente (Zoho exige que coincida) y STARTTLS en el 587" do
      with_env("SMTP_ADDRESS" => "smtp.zoho.com", "SMTP_USERNAME" => "hola@jellylang.com", "SMTP_PASSWORD" => "x")
      expect(Mailing.from).to eq("Jellylang <hola@jellylang.com>")
      expect(Mailing.smtp_settings).to include(address: "smtp.zoho.com", port: 587, enable_starttls_auto: true, ssl: false,
                                               user_name: "hola@jellylang.com", authentication: :login)
    end

    it "usa SSL directo en el puerto 465" do
      with_env("SMTP_ADDRESS" => "smtp.zoho.eu", "SMTP_PORT" => "465")
      expect(Mailing.smtp_settings).to include(ssl: true, enable_starttls_auto: false)
    end

    it "sin usuario (Mailpit) no autentica" do
      with_env("SMTP_ADDRESS" => "mailpit", "SMTP_PORT" => "1025")
      expect(Mailing.smtp_settings).not_to have_key(:authentication)
      expect(Mailing.smtp_configured?).to eq(true)
    end
  end
end
