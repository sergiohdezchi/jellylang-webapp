require "rails_helper"

RSpec.describe Subtitles::Json3Parser do
  def rows(name)
    Subtitles::Builder.call(described_class.parse(File.read(Rails.root.join("spec/fixtures/#{name}"))))
  end

  it "lee subtítulos automáticos con el inicio real de cada palabra" do
    result = rows("auto_captions.json3")

    expect(result.map { |r| r[:text] }).to eq(["hello everyone and welcome to my channel.", "today we cook pasta"])
    expect(result.first[:word_times]).to eq([0.16, 0.48, 0.8, 1.0, 2.32, 2.56, 2.8])
    expect(result.last[:word_times]).to eq([5.4, 5.6, 5.9, 6.2])
    expect(result.first[:end_time]).to be <= result.last[:start_time]
  end

  it "no inventa tiempos por palabra en subtítulos manuales" do
    result = rows("manual_captions.json3")

    expect(result.map { |r| r[:text] }).to eq(["Hello there, my friend.", "How are you?"])
    expect(result.map { |r| r[:word_times] }).to eq([nil, nil])
    expect(result.first[:start_time]).to eq(1.0)
  end

  it "descarta los tiempos que no cuadran con las palabras del texto" do
    json = { events: [{ tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: "can" }, { utf8: "'t", tOffsetMs: 200 }, { utf8: " stop", tOffsetMs: 400 }] }] }.to_json
    cues = described_class.parse(json)

    # "can't" son 2 fragmentos pero 1 palabra: el recuento no coincide y no se usan tiempos
    expect(cues.first[:timings]).to eq([nil])
  end

  it "falla con contenido que no es json3" do
    expect { described_class.parse("no es json") }.to raise_error(described_class::Error)
    expect { described_class.parse({ foo: 1 }.to_json) }.to raise_error(described_class::Error)
  end
end
