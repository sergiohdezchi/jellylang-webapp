require "json"

module Subtitles
  # Lee subtítulos en formato json3, el que usa el reproductor de YouTube, y devuelve los mismos cues que Parser:
  # [{ start: Float, end: Float, lines: [String], timings: [[Float] | nil] }]
  #
  # Los subtítulos automáticos traen el inicio de cada palabra (`segs[].tOffsetMs`); los manuales, no.
  # Los tiempos por palabra solo se devuelven cuando son reales y cuadran con las palabras del texto:
  # nunca se inventan.
  class Json3Parser
    class Error < StandardError; end

    def self.parse(content)
      new(content).cues
    end

    def initialize(content)
      @data = JSON.parse(content.to_s)
    rescue JSON::ParserError
      raise Error, I18n.t("errors.import.invalid_format")
    end

    def cues
      events = @data.is_a?(Hash) ? @data["events"] : nil
      raise Error, I18n.t("errors.import.invalid_format") unless events.is_a?(Array)

      events.filter_map { |event| build(event) }
    end

    private

    def build(event)
      return unless event.is_a?(Hash) && event["segs"].is_a?(Array) && event["tStartMs"].is_a?(Numeric)

      segs = event["segs"].select { |seg| seg.is_a?(Hash) }
      lines = segs.map { |seg| seg["utf8"].to_s }.join.split("\n").map { |line| Cleaner.call(line) }.reject(&:empty?)
      return if lines.empty?

      start = event["tStartMs"] / 1000.0
      finish = start + (event["dDurationMs"] || 0) / 1000.0
      { start: start, end: finish, lines: lines, timings: [lines.size == 1 ? word_times(segs, event["tStartMs"], lines.first) : nil] * lines.size }
    end

    # Inicio de cada palabra: tStartMs + tOffsetMs de su fragmento. Solo si el evento trae desplazamientos
    # (subtítulos automáticos) o es una sola palabra, y solo si el número de palabras coincide con el de la línea.
    def word_times(segs, start_ms, line)
      words = Text::Tokenizer.words(line)
      return if words.empty?
      return unless segs.any? { |seg| seg.key?("tOffsetMs") } || words.size == 1

      times = segs.flat_map do |seg|
        count = Text::Tokenizer.words(Cleaner.call(seg["utf8"])).size
        [(start_ms + seg["tOffsetMs"].to_i) / 1000.0] * count
      end
      times if times.size == words.size
    end
  end
end
