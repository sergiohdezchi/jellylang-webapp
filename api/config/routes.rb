require "sidekiq/web"

Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  mount Sidekiq::Web => "/sidekiq" if Rails.env.development?

  namespace :api do
    namespace :v1 do
      post "auth/signup", to: "auth#signup"
      post "auth/login", to: "auth#login"
      get "auth/me", to: "auth#me"
      patch "auth/me", to: "auth#update"

      get "config", to: "config#show"
      resources :languages, only: :index
      resources :courses, only: %i[index create update destroy]

      resources :lessons, only: %i[index show create update destroy] do
        post :youtube, on: :collection
        member do
          post :subtitles
          post :reimport
        end
      end

      # Importación desde fuentes externas (la extensión del navegador envía aquí los subtítulos)
      post "imports", to: "imports#create"

      resources :lingqs, only: %i[index create update destroy] do
        get :export, on: :collection
      end

      put "user_words", to: "user_words#upsert"
      post "user_words/bulk", to: "user_words#bulk"

      get "reviews/due", to: "reviews#due"
      post "reviews", to: "reviews#create"

      get "stats", to: "stats#show"
      post "stats/activity", to: "stats#activity"

      get "dictionary", to: "dictionary#show"
    end
  end
end
