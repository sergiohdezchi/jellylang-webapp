require "cgi"

module Subtitles
  # Lee archivos WebVTT o SRT y devuelve una lista de cues:
  # [{ start: Float, end: Float, lines: [String], timings: [[Float] | nil] }]
  #
  # Los subtítulos automáticos de YouTube incluyen el inicio de cada palabra
  # (`hola<00:00:01.230><c> mundo</c>`); `timings` los alinea con las palabras de cada línea.
  class Parser
    TIMESTAMP = /\A(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})\z/
    INLINE_TIMESTAMP = /<((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})>/
    NOISE = /\[[^\]]*\]|\((?:[^)]*\b(?:music|música|musique|musik|applause|aplausos|laughter|risas)\b[^)]*)\)|[♪♫]/i

    def self.parse(content)
      new(content).cues
    end

    def initialize(content)
      @content = content.to_s.dup.force_encoding(Encoding::UTF_8).scrub("")
                        .delete_prefix("﻿").gsub(/\r\n?/, "\n")
    end

    def cues
      @content.split(/\n{2,}/).filter_map { |block| parse_block(block) }
    end

    private

    def parse_block(block)
      lines = block.split("\n")
      timing_index = lines.index { |line| line.include?("-->") }
      return unless timing_index

      raw_start, raw_end = lines[timing_index].split("-->").map { |part| part.strip.split(/\s+/).first }
      start = seconds(raw_start)
      finish = seconds(raw_end)
      return unless start && finish

      parsed = lines[(timing_index + 1)..].map { |line| parse_line(line, start) }.reject { |text, _| text.empty? }
      return if parsed.empty?

      { start: start, end: finish, lines: parsed.map(&:first), timings: parsed.map(&:last) }
    end

    def seconds(value)
      match = TIMESTAMP.match(value.to_s)
      return unless match

      match[1].to_i * 3600 + match[2].to_i * 60 + match[3].to_i + "0.#{match[4]}".to_f
    end

    # Devuelve [texto limpio, tiempos por palabra o nil]
    def parse_line(raw, cue_start)
      text = clean(raw)
      parts = raw.split(INLINE_TIMESTAMP)
      if parts.size == 1
        # Sin marcas internas: una sola palabra es la primera de la línea y empieza con el cue
        # (así llegan las palabras que YouTube pone solas en una línea); con varias palabras es
        # una línea repetida del cue anterior y no se conoce el tiempo de cada una.
        return [text, Text::Tokenizer.words(text).size == 1 ? [cue_start] : nil]
      end

      times = []
      current = cue_start
      parts.each_with_index do |part, index|
        if index.odd?
          current = seconds(part) || current
        else
          Text::Tokenizer.words(clean(part)).size.times { times << current }
        end
      end

      [text, times.size == Text::Tokenizer.words(text).size ? times : nil]
    end

    def clean(line)
      text = line.gsub(/<[^>]*>/, "")
      text = CGI.unescapeHTML(text).gsub("&nbsp;", " ")
      text.gsub(NOISE, " ").sub(/\A\s*(?:>>|-)\s*/, "").gsub(/\s+/, " ").strip
    end
  end
end
