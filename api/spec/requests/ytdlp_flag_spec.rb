require "rails_helper"

RSpec.describe "Flag YTDLP_ENABLED", type: :request do
  let!(:user) { create_user }
  let(:language) { user.current_language }
  let(:headers) { auth_headers(user) }

  def with_ytdlp(value)
    allow(Features).to receive(:ytdlp_enabled?).and_return(value)
  end

  it "interpreta la variable de entorno (activado por defecto)" do
    {nil => true, "true" => true, "false" => false, "0" => false, "off" => false, "1" => true}.each do |raw, expected|
      stub_const("ENV", ENV.to_hash.merge("YTDLP_ENABLED" => raw).compact)
      expect(Features.ytdlp_enabled?).to eq(expected), "YTDLP_ENABLED=#{raw.inspect}"
    end
  end

  it "se anuncia en /config sin necesidad de sesión" do
    with_ytdlp(false)
    get "/api/v1/config"
    expect(json).to eq("ytdlp_enabled" => false, "import_sources" => ["youtube"])

    with_ytdlp(true)
    get "/api/v1/config"
    expect(json["ytdlp_enabled"]).to eq(true)
  end

  context "apagado" do
    before { with_ytdlp(false) }

    it "no importa por URL ni encola nada" do
      expect {
        post "/api/v1/lessons/youtube", params: { language_id: language.id, url: "https://youtu.be/dQw4w9WgXcQ" }, headers: headers
      }.not_to change(ImportYoutubeLessonJob.jobs, :size)

      expect(response).to have_http_status(:forbidden)
      expect(json).to include("code" => "ytdlp_disabled")
      expect(json["error"]).to include("extensión")
      expect(user.lessons.count).to eq(0)
    end

    it "no reintenta importaciones" do
      lesson = user.lessons.create!(language: language, title: "Video", source_type: "youtube", youtube_id: "dQw4w9WgXcQ", status: "failed")

      expect { post "/api/v1/lessons/#{lesson.id}/reimport", headers: headers }.not_to change(ImportYoutubeLessonJob.jobs, :size)
      expect(response).to have_http_status(:forbidden)
      expect(lesson.reload.status).to eq("failed")
    end

    it "deja de importar los trabajos que ya estaban en cola, sin consultar a YouTube" do
      lesson = user.lessons.create!(language: language, title: "Video", source_type: "youtube", youtube_id: "dQw4w9WgXcQ", status: "processing")
      expect(Youtube::Client).not_to receive(:new)

      ImportYoutubeLessonJob.new.perform(lesson.id)

      expect(lesson.reload).to have_attributes(status: "failed")
      expect(lesson.error_message).to include("yt-dlp")
    end

    it "sigue permitiendo importar con la extensión y subir subtítulos" do
      post "/api/v1/imports", params: { source: "youtube", language_id: language.id, video: { id: "dQw4w9WgXcQ", title: "Video" },
                                        track: { language: "en", format: "vtt", content: "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello world.\n" } },
                              headers: headers, as: :json
      expect(response).to have_http_status(:created)
    end
  end

  it "encendido, importa por URL como siempre" do
    with_ytdlp(true)
    expect {
      post "/api/v1/lessons/youtube", params: { language_id: language.id, url: "https://youtu.be/dQw4w9WgXcQ" }, headers: headers
    }.to change(ImportYoutubeLessonJob.jobs, :size).by(1)
    expect(response).to have_http_status(:accepted)
  end
end
