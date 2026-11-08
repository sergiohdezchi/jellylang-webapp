module Youtube
  module Url
    ID = /[A-Za-z0-9_-]{11}/
    PATTERNS = [
      %r{(?:youtube\.com|youtube-nocookie\.com)/(?:watch\?(?:.*&)?v=|embed/|shorts/|live/|v/)(#{ID})},
      %r{youtu\.be/(#{ID})}
    ].freeze

    module_function

    def extract_id(url)
      value = url.to_s.strip
      return value if value.match?(/\A#{ID}\z/)

      PATTERNS.each do |pattern|
        match = pattern.match(value)
        return match[1] if match
      end
      nil
    end

    def watch_url(id) = "https://www.youtube.com/watch?v=#{id}"
    def thumbnail_url(id) = "https://i.ytimg.com/vi/#{id}/hqdefault.jpg"
  end
end
