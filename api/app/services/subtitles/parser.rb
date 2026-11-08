require "cgi"

module Subtitles
  # Lee archivos WebVTT o SRT y devuelve una lista de cues:
  # [{ start: Float, end: Float, lines: [String] }]
  class Parser
    TIMESTAMP = /\A(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})\z/
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

      text_lines = lines[(timing_index + 1)..].map { |line| clean(line) }.reject(&:empty?)
      return if text_lines.empty?

      { start: start, end: finish, lines: text_lines }
    end

    def seconds(value)
      match = TIMESTAMP.match(value.to_s)
      return unless match

      match[1].to_i * 3600 + match[2].to_i * 60 + match[3].to_i + "0.#{match[4]}".to_f
    end

    def clean(line)
      text = line.gsub(/<[^>]*>/, "")
      text = CGI.unescapeHTML(text).gsub("&nbsp;", " ")
      text.gsub(NOISE, " ").sub(/\A\s*(?:>>|-)\s*/, "").gsub(/\s+/, " ").strip
    end
  end
end
