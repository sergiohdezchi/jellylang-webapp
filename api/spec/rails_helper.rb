require "spec_helper"
# Siempre en test, aunque el contenedor defina RAILS_ENV=development.
ENV["RAILS_ENV"] = "test"
require_relative "../config/environment"
require "rspec/rails"
require "webmock/rspec"
require "sidekiq/testing"

Sidekiq::Testing.fake!
WebMock.disable_net_connect!

begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  abort e.to_s.strip
end

module AuthHelpers
  def create_user(email: "ana@example.com", language_code: "en")
    language = Language.find_or_create_by!(code: language_code) { |l| l.name = language_code }
    user = User.create!(email: email, password: "Medusa-Azul-2026", current_language: language, email_verified_at: Time.current)
    user.user_languages.create!(language: language)
    user
  end

  def auth_headers(user)
    { "Authorization" => "Bearer #{JsonWebToken.encode(user.id)}" }
  end

  def json
    JSON.parse(response.body)
  end
end

RSpec.configure do |config|
  config.fixture_paths = [Rails.root.join("spec/fixtures")]
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!
  config.include AuthHelpers
  config.before { Rails.cache.clear rescue nil }
end
