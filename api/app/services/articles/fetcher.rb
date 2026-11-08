require "net/http"
require "resolv"
require "ipaddr"

module Articles
  # Descarga una página web y extrae su texto principal.
  class Fetcher
    class Error < StandardError; end

    MAX_BYTES = 3 * 1024 * 1024
    MAX_REDIRECTS = 3
    REMOVE = "script,style,noscript,nav,header,footer,aside,form,figure,iframe,svg,button,template"
    BLOCKS = "h1,h2,h3,h4,p,li,blockquote"

    def self.call(url)
      new(url).call
    end

    def initialize(url)
      @url = url.to_s.strip
    end

    def call
      html = fetch(parse(@url), MAX_REDIRECTS)
      doc = Nokogiri::HTML(html)
      title = doc.at('meta[property="og:title"]')&.[]("content").presence || doc.at("title")&.text
      doc.css(REMOVE).remove

      root = doc.at("article") || doc.at("main") || doc.at("[role=main]") || doc.at("body")
      raise Error, I18n.t("errors.article.no_text") unless root

      blocks = root.css(BLOCKS)
                   .reject { |node| node.at_css(BLOCKS) }
                   .map { |node| node.text.gsub(/\s+/, " ").strip }
                   .select { |text| text.length >= 25 }
                   .uniq
      raise Error, I18n.t("errors.article.no_text") if blocks.empty?

      { title: title.to_s.gsub(/\s+/, " ").strip.truncate(300), text: blocks.join("\n\n") }
    end

    private

    def parse(url)
      uri = URI.parse(url)
      raise Error, I18n.t("errors.article.invalid_url") unless uri.is_a?(URI::HTTP) && uri.host.present?

      uri
    rescue URI::InvalidURIError
      raise Error, I18n.t("errors.article.invalid_url")
    end

    def fetch(uri, redirects_left)
      ensure_public_host!(uri.host)

      response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 5, read_timeout: 15) do |http|
        request = Net::HTTP::Get.new(uri)
        request["User-Agent"] = "Mozilla/5.0 (compatible; LinguaQ/1.0)"
        request["Accept"] = "text/html,application/xhtml+xml"
        http.request(request)
      end

      case response
      when Net::HTTPRedirection
        raise Error, I18n.t("errors.article.too_many_redirects") if redirects_left.zero?

        fetch(parse(URI.join(uri, response["location"]).to_s), redirects_left - 1)
      when Net::HTTPSuccess
        body = response.body.to_s
        raise Error, I18n.t("errors.article.too_large") if body.bytesize > MAX_BYTES

        body
      else
        raise Error, I18n.t("errors.article.http_error", code: response.code)
      end
    rescue SocketError, Timeout::Error, Errno::ECONNREFUSED, OpenSSL::SSL::SSLError => e
      raise Error, I18n.t("errors.article.unreachable", reason: e.class.name.demodulize)
    end

    # Evita que el servidor haga peticiones a la red interna (SSRF).
    def ensure_public_host!(host)
      addresses = Resolv.getaddresses(host)
      raise Error, I18n.t("errors.article.unreachable", reason: "DNS") if addresses.empty?

      addresses.each do |address|
        ip = IPAddr.new(address)
        if ip.private? || ip.loopback? || ip.link_local? || ip.to_s == "0.0.0.0"
          raise Error, I18n.t("errors.article.invalid_url")
        end
      end
    end
  end
end
