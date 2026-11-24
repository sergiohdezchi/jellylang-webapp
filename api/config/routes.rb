require "sidekiq/web"

Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  mount Sidekiq::Web => "/sidekiq" if Rails.env.development?

  namespace :api do
    namespace :v1 do
      post "auth/signup", to: "auth#signup"
      post "auth/login", to: "auth#login"
      post "auth/verify_email", to: "auth#verify_email"
      post "auth/resend_code", to: "auth#resend_code"
      post "auth/forgot_password", to: "auth#forgot_password"
      post "auth/reset_password", to: "auth#reset_password"
      get "auth/me", to: "auth#me"
      patch "auth/me", to: "auth#update"
      delete "auth/session", to: "auth#destroy_session"

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

      # Panel de administración (solo usuarios con admin = true)
      namespace :admin do
        get "overview", to: "overview#show"
        resources :settings, only: %i[index update destroy]
        resources :users, only: %i[index create update destroy]
        resources :languages, only: %i[index create update destroy]
      end
    end
  end
end
