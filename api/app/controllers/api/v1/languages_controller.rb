module Api
  module V1
    class LanguagesController < ApplicationController
      skip_before_action :authenticate!

      def index
        render json: Language.order(:name)
      end
    end
  end
end
