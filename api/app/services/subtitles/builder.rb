module Subtitles
  # Convierte cues en segmentos legibles:
  # - elimina las líneas repetidas en cascada de los subtítulos automáticos
  # - une fragmentos cortos en frases completas conservando start y end
  class Builder
    MAX_CHARS = 200
    MAX_DURATION = 12.0
    MAX_GAP = 2.0
    SENTENCE_END = /[.!?…。！？]["'»”’)\]]*\z/

    def self.call(cues)
      new(cues).rows
    end

    def initialize(cues)
      @cues = cues.sort_by { |cue| cue[:start] }
    end

    def rows
      segments = merge(dedupe)
      segments.each_with_index do |segment, index|
        following = segments[index + 1]
        segment[:end_time] = following[:start_time] if following && following[:start_time] < segment[:end_time] && following[:start_time] > segment[:start_time]
        segment[:end_time] = segment[:start_time] + 0.5 if segment[:end_time] <= segment[:start_time]
        segment[:paragraph] = index
      end
    end

    private

    def dedupe
      recent = []
      @cues.each_with_object([]) do |cue, fragments|
        cue[:lines].each_with_index do |line, index|
          next if recent.include?(line)

          fragments << { text: line, start_time: cue[:start], end_time: cue[:end], word_times: cue.dig(:timings, index) }
          recent = (recent + [line]).last(2)
        end
      end
    end

    def merge(fragments)
      rows = []
      buffer = nil

      fragments.each do |fragment|
        if buffer && fragment[:start_time] - buffer[:end_time] > MAX_GAP
          rows << buffer
          buffer = nil
        end

        if buffer
          buffer[:word_times] = times_for(buffer) + times_for(fragment)
          buffer[:text] = "#{buffer[:text]} #{fragment[:text]}"
          buffer[:end_time] = [buffer[:end_time], fragment[:end_time]].max
        else
          buffer = fragment.dup
        end

        if buffer[:text].match?(SENTENCE_END) || buffer[:text].length >= MAX_CHARS ||
           buffer[:end_time] - buffer[:start_time] >= MAX_DURATION
          rows << buffer
          buffer = nil
        end
      end

      rows << buffer if buffer
      rows.each { |row| row[:word_times] = nil if row[:word_times]&.all?(&:nil?) }
    end

    # Tiempos por palabra del fragmento; nil donde no se conocen.
    def times_for(fragment)
      fragment[:word_times] || Array.new(Text::Tokenizer.words(fragment[:text]).size)
    end
  end
end
