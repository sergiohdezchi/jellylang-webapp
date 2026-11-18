require "cgi"

module Subtitles
  # Limpia una línea de subtítulo: etiquetas, entidades HTML, anotaciones de sonido y marcas de hablante.
  module Cleaner
    NOISE = /\[[^\]]*\]|\((?:[^)]*\b(?:music|música|musique|musik|applause|aplausos|laughter|risas)\b[^)]*)\)|[♪♫]/i

    module_function

    def call(line)
      text = line.to_s.gsub(/<[^>]*>/, "")
      text = CGI.unescapeHTML(text).gsub("&nbsp;", " ")
      text.gsub(NOISE, " ").sub(/\A\s*(?:>>|-)\s*/, "").gsub(/\s+/, " ").strip
    end
  end
end
