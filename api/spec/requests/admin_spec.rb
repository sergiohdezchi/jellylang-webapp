require "rails_helper"

RSpec.describe "Panel de administración", type: :request do
  let!(:admin) { create_user(email: "admin@example.com").tap { |u| u.update!(admin: true) } }
  let!(:member) { create_user(email: "ana@example.com") }
  let(:admin_headers) { auth_headers(admin) }
  let(:english) { admin.current_language }

  describe "acceso" do
    it "exige ser administrador" do
      %w[/api/v1/admin/overview /api/v1/admin/users /api/v1/admin/settings /api/v1/admin/languages].each do |path|
        get path, headers: auth_headers(member)
        expect(response).to have_http_status(:forbidden), path
        expect(json["code"]).to eq("admin_required")
      end
    end

    it "exige sesión" do
      get "/api/v1/admin/overview"
      expect(response).to have_http_status(:unauthorized)
    end

    it "indica en el perfil si el usuario es administrador" do
      get "/api/v1/auth/me", headers: admin_headers
      expect(json["admin"]).to eq(true)
      get "/api/v1/auth/me", headers: auth_headers(member)
      expect(json["admin"]).to eq(false)
    end
  end

  it "muestra un resumen del sistema con las importaciones fallidas" do
    member.lessons.create!(language: english, title: "Roto", source_type: "youtube", youtube_id: "dQw4w9WgXcQ", status: "failed", error_message: "HTTP 429")

    get "/api/v1/admin/overview", headers: admin_headers

    expect(json.dig("users", "total")).to eq(2)
    expect(json.dig("users", "admins")).to eq(1)
    expect(json.dig("lessons", "failed")).to eq(1)
    expect(json["failed_imports"].first).to include("title" => "Roto", "error_message" => "HTTP 429", "user_email" => "ana@example.com")
  end

  describe "ajustes" do
    it "el valor del panel manda sobre la variable de entorno y se puede restablecer" do
      stub_const("ENV", ENV.to_hash.merge("YTDLP_ENABLED" => "true"))

      get "/api/v1/admin/settings", headers: admin_headers
      expect(json.find { |s| s["key"] == "ytdlp_enabled" }).to include("value" => true, "source" => "env", "env" => "YTDLP_ENABLED")

      patch "/api/v1/admin/settings/ytdlp_enabled", params: { value: false }, headers: admin_headers, as: :json
      expect(json).to include("value" => false, "source" => "panel")
      expect(Features.ytdlp_enabled?).to eq(false)
      expect(AppSetting.find_by(key: "ytdlp_enabled").updated_by).to eq(admin)

      get "/api/v1/config"
      expect(json["ytdlp_enabled"]).to eq(false)

      post "/api/v1/lessons/youtube", params: { language_id: english.id, url: "https://youtu.be/dQw4w9WgXcQ" }, headers: auth_headers(member)
      expect(response).to have_http_status(:forbidden)

      delete "/api/v1/admin/settings/ytdlp_enabled", headers: admin_headers
      expect(json).to include("value" => true, "source" => "env")
      expect(Features.ytdlp_enabled?).to eq(true)
    end

    it "sin variable de entorno usa el valor por defecto" do
      stub_const("ENV", ENV.to_hash.except("YTDLP_ENABLED"))
      expect(Settings.resolve("ytdlp_enabled")).to include(value: true, source: "default")
    end

    it "rechaza ajustes desconocidos" do
      patch "/api/v1/admin/settings/borrar_todo", params: { value: true }, headers: admin_headers, as: :json
      expect(response).to have_http_status(:not_found)
    end

    it "cierra los registros" do
      patch "/api/v1/admin/settings/signups_enabled", params: { value: false }, headers: admin_headers, as: :json

      get "/api/v1/config"
      expect(json["signups_enabled"]).to eq(false)

      post "/api/v1/auth/signup", params: { email: "nuevo@example.com", password: "password123" }
      expect(response).to have_http_status(:forbidden)
      expect(json["code"]).to eq("signups_disabled")
      expect(User.exists?(email: "nuevo@example.com")).to eq(false)
    end

    it "con la base de datos vacía siempre deja crear la primera cuenta" do
      Settings.set("signups_enabled", false)
      User.delete_all
      expect(Features.signups_enabled?).to eq(true)
    end
  end

  describe "usuarios" do
    it "lista y busca con sus cifras" do
      member.lessons.create!(language: english, title: "Una", source_type: "text")

      get "/api/v1/admin/users", params: { q: "ana" }, headers: admin_headers

      expect(json["total"]).to eq(1)
      expect(json["items"].first).to include("email" => "ana@example.com", "admin" => false, "disabled" => false, "lessons_count" => 1, "current_language" => "en")
    end

    it "da de alta usuarios (aunque el registro esté cerrado)" do
      Settings.set("signups_enabled", false)

      post "/api/v1/admin/users", params: { email: "Nuevo@Example.com", password: "password123", name: "Nuevo", study_language_id: english.id }, headers: admin_headers, as: :json
      expect(response).to have_http_status(:created)
      expect(json).to include("email" => "nuevo@example.com", "admin" => false, "current_language" => "en")

      post "/api/v1/auth/login", params: { email: "nuevo@example.com", password: "password123" }
      expect(response).to have_http_status(:ok)

      post "/api/v1/admin/users", params: { email: "nuevo@example.com", password: "password123" }, headers: admin_headers, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "da y quita el rol de administrador" do
      patch "/api/v1/admin/users/#{member.id}", params: { admin: true }, headers: admin_headers, as: :json
      expect(json["admin"]).to eq(true)

      get "/api/v1/admin/overview", headers: auth_headers(member)
      expect(response).to have_http_status(:ok)

      patch "/api/v1/admin/users/#{member.id}", params: { admin: false }, headers: admin_headers, as: :json
      expect(member.reload.admin).to eq(false)
    end

    it "desactivar corta las sesiones y el acceso; reactivar lo devuelve" do
      member_headers = auth_headers(member)
      patch "/api/v1/admin/users/#{member.id}", params: { disabled: true }, headers: admin_headers, as: :json
      expect(json["disabled"]).to eq(true)

      get "/api/v1/auth/me", headers: member_headers
      expect(response).to have_http_status(:unauthorized)

      post "/api/v1/auth/login", params: { email: "ana@example.com", password: "password123" }
      expect(response).to have_http_status(:forbidden)
      expect(json["code"]).to eq("account_disabled")

      patch "/api/v1/admin/users/#{member.id}", params: { disabled: false }, headers: admin_headers, as: :json
      get "/api/v1/auth/me", headers: member_headers
      expect(response).to have_http_status(:ok)
    end

    it "cambia la contraseña" do
      patch "/api/v1/admin/users/#{member.id}", params: { password: "nueva-clave-1" }, headers: admin_headers, as: :json
      expect(response).to have_http_status(:ok)

      post "/api/v1/auth/login", params: { email: "ana@example.com", password: "nueva-clave-1" }
      expect(response).to have_http_status(:ok)

      patch "/api/v1/admin/users/#{member.id}", params: { password: "corta" }, headers: admin_headers, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "no deja que un administrador se quite el rol, se desactive o se borre" do
      patch "/api/v1/admin/users/#{admin.id}", params: { admin: false }, headers: admin_headers, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["code"]).to eq("admin_self")

      patch "/api/v1/admin/users/#{admin.id}", params: { disabled: true }, headers: admin_headers, as: :json
      expect(json["code"]).to eq("admin_self")

      delete "/api/v1/admin/users/#{admin.id}", headers: admin_headers
      expect(json["code"]).to eq("admin_self")
      expect(admin.reload).to have_attributes(admin: true, disabled_at: nil)

      # Su propio nombre sí lo puede cambiar
      patch "/api/v1/admin/users/#{admin.id}", params: { name: "Jefa" }, headers: admin_headers, as: :json
      expect(json["name"]).to eq("Jefa")
    end

    it "borra a un usuario con todos sus datos" do
      lesson = member.lessons.create!(language: english, title: "Una", source_type: "text")
      lesson.replace_segments!([{ text: "Hola mundo." }])

      delete "/api/v1/admin/users/#{member.id}", headers: admin_headers

      expect(response).to have_http_status(:no_content)
      expect(User.exists?(member.id)).to eq(false)
      expect(Lesson.exists?(lesson.id)).to eq(false)
    end
  end

  describe "idiomas" do
    it "lista con su uso, crea y valida el código" do
      get "/api/v1/admin/languages", headers: admin_headers
      expect(json.find { |l| l["code"] == "en" }).to include("users_count" => 2, "enabled" => true)

      post "/api/v1/admin/languages", params: { code: " SV ", name: "Svenska" }, headers: admin_headers, as: :json
      expect(response).to have_http_status(:created)
      expect(json).to include("code" => "sv", "name" => "Svenska", "enabled" => true)

      post "/api/v1/admin/languages", params: { code: "sv", name: "Otra vez" }, headers: admin_headers, as: :json
      expect(response).to have_http_status(:unprocessable_entity)

      post "/api/v1/admin/languages", params: { code: "pt-BR", name: "Português" }, headers: admin_headers, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "un idioma desactivado deja de ofrecerse, pero quien ya lo estudia lo conserva" do
      german = Language.create!(code: "de", name: "Deutsch")
      member.user_languages.create!(language: german)

      patch "/api/v1/admin/languages/#{german.id}", params: { enabled: false, name: "Alemán" }, headers: admin_headers, as: :json
      expect(json).to include("enabled" => false, "name" => "Alemán", "code" => "de")

      get "/api/v1/languages"
      expect(json.map { |l| l["code"] }).not_to include("de")

      # Quien ya lo estudia puede seguir con él
      patch "/api/v1/auth/me", params: { study_languages: [{ language_id: english.id }, { language_id: german.id }] }, headers: auth_headers(member), as: :json
      expect(response).to have_http_status(:ok)

      # Nadie puede empezar a estudiarlo
      patch "/api/v1/auth/me", params: { current_language_id: german.id }, headers: admin_headers, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(admin.reload.user_languages.where(language: german)).to be_empty
    end

    it "solo borra idiomas que nadie usa" do
      patch "/api/v1/admin/languages/#{english.id}", params: { name: "English" }, headers: admin_headers, as: :json
      delete "/api/v1/admin/languages/#{english.id}", headers: admin_headers
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["code"]).to eq("language_in_use")

      unused = Language.create!(code: "fi", name: "Suomi")
      Word.create!(language: unused, term: "huérfana")
      delete "/api/v1/admin/languages/#{unused.id}", headers: admin_headers
      expect(response).to have_http_status(:no_content)
      expect(Language.exists?(unused.id)).to eq(false)
    end
  end
end
