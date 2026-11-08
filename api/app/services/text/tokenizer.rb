module Text
  # Debe mantenerse sincronizado con web/src/lib/tokenize.ts
  module Tokenizer
    WORD = /[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/
    EDGE_PUNCTUATION = /\A[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+\z/

    module_function

    def words(text)
      text.to_s.scan(WORD)
    end

    def terms(text)
      words(text).map { |word| normalize(word) }.uniq
    end

    # Forma canónica de una palabra o frase: NFC, minúsculas, apóstrofo recto,
    # sin puntuación en los extremos y con espacios simples.
    def normalize(term)
      term.to_s.unicode_normalize(:nfc).tr("’", "'").downcase
          .gsub(/\s+/, " ").gsub(EDGE_PUNCTUATION, "").strip
    end
  end
end
