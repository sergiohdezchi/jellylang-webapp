require "net/http"

module Translation
  # Traducción automática de palabras y frases.
  # Usa DeepL si hay DEEPL_API_KEY; si no, MyMemory (gratuito, sin clave).
  module Client
    module_function

    def translate(text, from:, to:)
      text = text.to_s.strip
      return if text.empty? || from == to

      Rails.cache.fetch(["translation", provider, from, to, text.downcase], expires_in: 30.days, skip_nil: true) do
        provider == "deepl" ? deepl(text, from, to) : mymemory(text, from, to)
      end
    rescue StandardError => e
      Rails.logger.warn("[translation] #{e.class}: #{e.message}")
      nil
    end

    def provider
      ENV["DEEPL_API_KEY"].present? ? "deepl" : "mymemory"
    end

    def mymemory(text, from, to)
      uri = URI("https://api.mymemory.translated.net/get")
      uri.query = URI.encode_www_form(q: text, langpair: "#{from}|#{to}")
      data = JSON.parse(get(uri))
      main = data.dig("responseData", "translatedText").to_s
      alternatives = Array(data["matches"]).map { |m| m["translation"].to_s.strip }
      clean([main, *alternatives])
    end

    def deepl(text, from, to)
      key = ENV.fetch("DEEPL_API_KEY")
      host = key.end_with?(":fx") ? "api-free.deepl.com" : "api.deepl.com"
      target = { "en" => "EN-US", "pt" => "PT-BR" }.fetch(to, to.upcase)
      uri = URI("https://#{host}/v2/translate")
      response = Net::HTTP.post_form(uri, text: text, source_lang: from.upcase, target_lang: target, auth_key: key)
      data = JSON.parse(response.body)
      clean(Array(data["translations"]).map { |t| t["text"] })
    end

    def get(uri)
      Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 4, read_timeout: 6) do |http|
        http.get(uri.request_uri).body
      end
    end

    def clean(candidates)
      list = candidates.map { |c| c.to_s.strip }.reject(&:empty?)
                       .reject { |c| c.match?(/MYMEMORY WARNING|QUERY LENGTH LIMIT/i) }
                       .uniq(&:downcase).first(5)
      return if list.empty?

      { translation: list.first, alternatives: list.drop(1) }
    end
  end
end
