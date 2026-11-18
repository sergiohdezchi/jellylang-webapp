module Api
  module V1
    # Capacidades del servidor que la interfaz necesita conocer antes de iniciar sesión.
    class ConfigController < ApplicationController
      skip_before_action :authenticate!

      def show
        render json: {
          ytdlp_enabled: Features.ytdlp_enabled?,
          signups_enabled: Features.signups_enabled?,
          import_sources: Imports::Video::SOURCES
        }
      end
    end
  end
end
