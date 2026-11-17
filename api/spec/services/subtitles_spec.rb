require "rails_helper"

RSpec.describe Subtitles do
  it "limpia la cascada de subtítulos automáticos y une frases" do
    content = File.read(Rails.root.join("spec/fixtures/auto_captions.vtt"))
    rows = Subtitles::Builder.call(Subtitles::Parser.parse(content))

    expect(rows.map { |r| r[:text] }).to eq(["hello everyone and welcome to my channel.", "today we cook pasta"])
    expect(rows.first[:start_time]).to eq(0.16)
    expect(rows.last[:start_time]).to eq(5.0)
    expect(rows.first[:end_time]).to be <= rows.last[:start_time]
  end

  it "conserva el inicio de cada palabra de los subtítulos automáticos" do
    content = File.read(Rails.root.join("spec/fixtures/auto_captions.vtt"))
    rows = Subtitles::Builder.call(Subtitles::Parser.parse(content))

    expect(rows.first[:word_times]).to eq([0.16, 0.48, 0.8, 1.0, 2.32, 2.56, 2.8])
    expect(rows.last[:word_times]).to eq([5.0, 5.4, 5.6, 5.9])
  end

  it "da tiempo a la palabra que YouTube pone sola en una línea" do
    vtt = <<~VTT
      WEBVTT

      00:00:01.000 --> 00:00:03.000
      hello<00:00:01.400><c> there</c>

      00:00:03.000 --> 00:00:03.010
      hello there


      00:00:03.010 --> 00:00:05.000
      hello there
      friend.
    VTT
    rows = Subtitles::Builder.call(Subtitles::Parser.parse(vtt))

    expect(rows.map { |r| r[:text] }).to eq(["hello there friend."])
    expect(rows.first[:word_times]).to eq([1.0, 1.4, 3.01])
  end

  it "no inventa tiempos por palabra en subtítulos normales" do
    srt = "1\n00:00:01,000 --> 00:00:02,500\nHola mundo.\n"
    expect(Subtitles::Builder.call(Subtitles::Parser.parse(srt)).first[:word_times]).to be_nil
  end

  it "lee SRT" do
    srt = "1\n00:00:01,000 --> 00:00:02,500\nHola <i>mundo</i>.\n\n2\n00:00:03,000 --> 00:00:04,000\n¿Qué tal?\n"
    rows = Subtitles::Builder.call(Subtitles::Parser.parse(srt))
    expect(rows.map { |r| [r[:text], r[:start_time]] }).to eq([["Hola mundo.", 1.0], ["¿Qué tal?", 3.0]])
  end
end

RSpec.describe Youtube::Url do
  it "extrae el ID de distintos formatos" do
    %w[
      https://www.youtube.com/watch?v=dQw4w9WgXcQ
      https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ
      https://youtu.be/dQw4w9WgXcQ?t=10
      https://www.youtube.com/shorts/dQw4w9WgXcQ
      https://www.youtube.com/embed/dQw4w9WgXcQ
    ].each { |url| expect(described_class.extract_id(url)).to eq("dQw4w9WgXcQ") }
    expect(described_class.extract_id("https://example.com/video")).to be_nil
  end
end

RSpec.describe Youtube::Client do
  let(:client) { described_class.new("abc") }

  it "prefiere subtítulos manuales" do
    info = { "subtitles" => { "en-GB" => [] }, "automatic_captions" => { "en" => [] }, "language" => "en" }
    expect(client.pick_track("en", info)).to eq(lang: "en-GB", auto: false)
  end

  it "acepta automáticos solo en el idioma original" do
    expect(client.pick_track("en", { "automatic_captions" => { "en-orig" => [], "en" => [] } })).to eq(lang: "en-orig", auto: true)
    expect(client.pick_track("es", { "automatic_captions" => { "es" => [] }, "language" => "en" })).to be_nil
  end
end
