module Api
  module V1
    module Admin
      # Todo lo que cuelga de /api/v1/admin exige un usuario administrador.
      class BaseController < ApplicationController
        before_action :require_admin!

        private

        def require_admin!
          raise ApiError.new(I18n.t("errors.admin.forbidden"), status: :forbidden, code: "admin_required") unless current_user.admin?
        end
      end
    end
  end
end
