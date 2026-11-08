require "rails_helper"

RSpec.describe Text::Tokenizer do
  it "extrae palabras con apóstrofos y guiones" do
    expect(described_class.words("It's a well-known café, isn't it? 42")).to eq(%w[It's a well-known café isn't it])
  end

  it "normaliza términos" do
    expect(described_class.normalize("  Don’t! ")).to eq("don't")
    expect(described_class.normalize("«Hola   Mundo»")).to eq("hola mundo")
  end
end

RSpec.describe Text::Segmenter do
  it "divide en párrafos y frases sin cortar decimales" do
    rows = described_class.call("Hello there. It costs 3.5 dollars!\n\nNew paragraph? Yes.")
    expect(rows.map { |r| r[:text] }).to eq(["Hello there.", "It costs 3.5 dollars!", "New paragraph?", "Yes."])
    expect(rows.map { |r| r[:paragraph] }).to eq([0, 0, 1, 1])
  end
end
