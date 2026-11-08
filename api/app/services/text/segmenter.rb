module Text
  # Divide texto plano en párrafos y frases.
  module Segmenter
    # Corta en espacios precedidos por puntuación final (con comilla o paréntesis opcional).
    BOUNDARY = /(?<=[.!?…]|[.!?…]["'»”’)\]])\s+/

    module_function

    def call(text)
      paragraphs(text).each_with_index.flat_map do |paragraph, index|
        sentences(paragraph).map { |sentence| { text: sentence, paragraph: index } }
      end
    end

    def paragraphs(text)
      normalized = text.to_s.unicode_normalize(:nfc).gsub(/\r\n?/, "\n").strip
      separator = normalized.match?(/\n[ \t]*\n/) ? /\n[ \t]*\n+/ : /\n+/
      normalized.split(separator).map { |p| p.gsub(/\s+/, " ").strip }.reject(&:empty?)
    end

    def sentences(paragraph)
      paragraph.split(BOUNDARY).map(&:strip).reject(&:empty?)
    end
  end
end
