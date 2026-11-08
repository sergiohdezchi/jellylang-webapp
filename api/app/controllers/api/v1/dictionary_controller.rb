module Api
  module V1
    class DictionaryController < ApplicationController
      def show
        term = params.require(:term).to_s.strip.first(500)
        from = params.require(:from).to_s
        to = params[:to].presence || current_user.native_language

        result = Translation::Client.translate(term, from: from, to: to)
        render json: { term: term, from: from, to: to, provider: Translation::Client.provider, **(result || { translation: nil, alternatives: [] }) }
      end
    end
  end
end
