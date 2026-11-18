module Api
  module V1
    module Admin
      class SettingsController < BaseController
        def index
          render json: Settings.all
        end

        # PATCH /admin/settings/:id { value } — :id es la clave del ajuste
        def update
          Settings.set(params[:id], params.require(:value), user: current_user)
          render json: { key: params[:id], **Settings.resolve(params[:id]) }
        end

        # Quita el valor del panel y vuelve al de la variable de entorno o al de por defecto
        def destroy
          Settings.reset(params[:id])
          render json: { key: params[:id], **Settings.resolve(params[:id]) }
        end

        rescue_from Settings::UnknownSetting do |e|
          render_error(I18n.t("errors.admin.unknown_setting", key: e.message), :not_found)
        end
      end
    end
  end
end
