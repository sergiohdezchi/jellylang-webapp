require "rails_helper"

RSpec.describe "Flujo principal", type: :request do
  let!(:user) { create_user }
  let(:language) { user.current_language }
  let(:headers) { auth_headers(user) }

  it "registra (pendiente de código) e inicia sesión" do
    post "/api/v1/auth/signup", params: { email: "Nuevo@Example.com", password: "Medusa-Azul-2026", study_language_id: language.id }
    expect(response).to have_http_status(:accepted)
    expect(json).not_to have_key("token")

    User.find_by!(email: "nuevo@example.com").update_columns(email_verified_at: Time.current)
    post "/api/v1/auth/login", params: { email: "nuevo@example.com", password: "Medusa-Azul-2026" }
    expect(json["token"]).to be_present
    expect(json.dig("user", "current_language", "code")).to eq("en")

    post "/api/v1/auth/login", params: { email: "nuevo@example.com", password: "mala" }
    expect(response).to have_http_status(:unauthorized)
  end

  it "rechaza peticiones sin token" do
    get "/api/v1/lessons"
    expect(response).to have_http_status(:unauthorized)
  end

  it "crea una lección, guarda un LingQ, marca palabras y repasa" do
    post "/api/v1/lessons", params: { language_id: language.id, content: "The cat sleeps. The dog barks!" }, headers: headers
    expect(response).to have_http_status(:created)
    lesson_id = json["id"]
    expect(json["word_count"]).to eq(6)

    post "/api/v1/lingqs", params: { language_id: language.id, term: "Cat", meaning: "gato", lesson_id: lesson_id }, headers: headers
    expect(json["entry"]).to include("term" => "cat", "status" => "learning", "level" => 1, "meaning" => "gato")
    lingq_id = json.dig("lingq", "id")

    post "/api/v1/user_words/bulk", params: { language_id: language.id, terms: %w[the cat sleeps] }, headers: headers
    expect(json["terms"]).to match_array(%w[the sleeps])

    get "/api/v1/lessons/#{lesson_id}", headers: headers
    expect(json["segments"].size).to eq(2)
    expect(json["vocabulary"].keys).to match_array(%w[the cat sleeps])
    expect(json.dig("vocabulary", "the", "status")).to eq("known")

    get "/api/v1/reviews/due", params: { language_id: language.id }, headers: headers
    expect(json["total"]).to eq(1)

    post "/api/v1/reviews", params: { lingq_id: lingq_id, rating: 3 }, headers: headers
    expect(response).to have_http_status(:ok)
    expect(json["level"]).to eq(2)

    get "/api/v1/stats", params: { language_id: language.id }, headers: headers
    expect(json).to include("known_words" => 2, "lingqs" => 1, "due_reviews" => 0, "streak" => 1)
    expect(json.dig("today", "reviews")).to eq(1)
  end

  it "importa YouTube en segundo plano" do
    expect {
      post "/api/v1/lessons/youtube", params: { language_id: language.id, url: "https://youtu.be/dQw4w9WgXcQ" }, headers: headers
    }.to change(ImportYoutubeLessonJob.jobs, :size).by(1)
    expect(response).to have_http_status(:accepted)
    expect(json).to include("status" => "processing", "youtube_id" => "dQw4w9WgXcQ")
  end

  it "permite subir subtítulos manualmente" do
    lesson = user.lessons.create!(language: language, title: "Video", source_type: "youtube", youtube_id: "dQw4w9WgXcQ", status: "failed")
    post "/api/v1/lessons/#{lesson.id}/subtitles", params: { content: "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello world.\n" }, headers: headers
    expect(json["status"]).to eq("ready")
    expect(lesson.segments.reload.first.start_time).to eq(1.0)
  end

  it "no permite ver lecciones de otro usuario" do
    other = create_user(email: "otro@example.com")
    lesson = other.lessons.create!(language: language, title: "Privada", source_type: "text")
    get "/api/v1/lessons/#{lesson.id}", headers: headers
    expect(response).to have_http_status(:not_found)
  end
end
