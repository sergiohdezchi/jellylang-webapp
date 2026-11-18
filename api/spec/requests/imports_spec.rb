require "rails_helper"

RSpec.describe "Importación desde la extensión", type: :request do
  let!(:user) { create_user }
  let(:language) { user.current_language }
  let(:headers) { auth_headers(user) }
  let(:auto_json3) { File.read(Rails.root.join("spec/fixtures/auto_captions.json3")) }
  let(:manual_json3) { File.read(Rails.root.join("spec/fixtures/manual_captions.json3")) }

  def payload(overrides = {})
    {
      source: "youtube",
      language_id: language.id,
      video: { id: "8S0FDjFBj8o", title: "How to sound smart", author: "TEDx Talks", duration: 356 },
      track: { language: "en", kind: "asr", format: "json3", content: auto_json3 }
    }.deep_merge(overrides)
  end

  it "crea la lección con segmentos y tiempos por palabra" do
    post "/api/v1/imports", params: payload, headers: headers, as: :json

    expect(response).to have_http_status(:created)
    expect(json["created"]).to eq(true)
    expect(json["lesson"]).to include("title" => "How to sound smart", "source_type" => "youtube", "youtube_id" => "8S0FDjFBj8o", "status" => "ready", "duration" => 356)

    get "/api/v1/lessons/#{json['lesson']['id']}", headers: headers
    expect(json["subtitle_source"]).to eq("auto")
    expect(json["segments"].map { |s| s["text"] }).to eq(["hello everyone and welcome to my channel.", "today we cook pasta"])
    expect(json["segments"].first["word_times"]).to eq([0.16, 0.48, 0.8, 1.0, 2.32, 2.56, 2.8])
  end

  it "marca los subtítulos manuales y no guarda tiempos por palabra" do
    post "/api/v1/imports", params: payload(track: { kind: "manual", content: manual_json3 }), headers: headers, as: :json
    get "/api/v1/lessons/#{json['lesson']['id']}", headers: headers

    expect(json["subtitle_source"]).to eq("manual")
    expect(json["segments"].map { |s| s["word_times"] }).to eq([nil, nil])
  end

  it "actualiza la lección existente en vez de duplicarla" do
    post "/api/v1/imports", params: payload, headers: headers, as: :json
    id = json["lesson"]["id"]

    post "/api/v1/imports", params: payload(track: { kind: "manual", content: manual_json3 }), headers: headers, as: :json
    expect(response).to have_http_status(:ok)
    expect(json["created"]).to eq(false)
    expect(json["lesson"]["id"]).to eq(id)
    expect(user.lessons.where(youtube_id: "8S0FDjFBj8o").count).to eq(1)
    expect(Lesson.find(id).segments.pluck(:text)).to eq(["Hello there, my friend.", "How are you?"])
  end

  it "recupera una lección de YouTube que había fallado" do
    failed = user.lessons.create!(language: language, title: "YouTube 8S0FDjFBj8o", source_type: "youtube", youtube_id: "8S0FDjFBj8o", status: "failed", error_message: "sin subtítulos")

    post "/api/v1/imports", params: payload, headers: headers, as: :json

    expect(json["lesson"]["id"]).to eq(failed.id)
    expect(failed.reload).to have_attributes(status: "ready", error_message: nil, title: "How to sound smart")
  end

  it "acepta subtítulos regionales del mismo idioma (en-GB)" do
    post "/api/v1/imports", params: payload(track: { language: "en-GB" }), headers: headers, as: :json
    expect(response).to have_http_status(:created)
  end

  it "rechaza subtítulos de otro idioma" do
    post "/api/v1/imports", params: payload(track: { language: "es" }), headers: headers, as: :json
    expect(response).to have_http_status(:unprocessable_entity)
    expect(json["error"]).to include("'es'")
  end

  it "rechaza datos no válidos" do
    post "/api/v1/imports", params: payload(source: "netflix"), headers: headers, as: :json
    expect(response).to have_http_status(:unprocessable_entity)

    post "/api/v1/imports", params: payload(video: { id: "no es un id" }), headers: headers, as: :json
    expect(response).to have_http_status(:unprocessable_entity)

    post "/api/v1/imports", params: payload(track: { format: "docx" }), headers: headers, as: :json
    expect(response).to have_http_status(:unprocessable_entity)

    post "/api/v1/imports", params: payload(track: { content: "no es json" }), headers: headers, as: :json
    expect(response).to have_http_status(:unprocessable_entity)

    expect(user.lessons.count).to eq(0)
  end

  it "exige sesión" do
    post "/api/v1/imports", params: payload, as: :json
    expect(response).to have_http_status(:unauthorized)
  end
end
