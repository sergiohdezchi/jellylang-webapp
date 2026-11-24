require_relative "boot"

require "rails"
require "active_model/railtie"
require "active_record/railtie"
require "action_controller/railtie"
require "action_mailer/railtie"

Bundler.require(*Rails.groups)

module Api
  class Application < Rails::Application
    config.load_defaults 8.1
    config.autoload_lib(ignore: %w[assets tasks])

    config.api_only = true
    config.time_zone = "UTC"
    config.i18n.available_locales = %i[es en]
    config.i18n.default_locale = :es

    # Caché compartida en Redis (traducciones, etc.)
    config.cache_store = :redis_cache_store, {
      url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0"),
      namespace: "jellylang:cache"
    }

    # Sesión mínima solo para el panel web de Sidekiq
    config.session_store :cookie_store, key: "_jellylang_session"
    config.middleware.use ActionDispatch::Cookies
    config.middleware.use config.session_store, config.session_options

    config.generators do |g|
      g.test_framework :rspec
    end
  end
end
