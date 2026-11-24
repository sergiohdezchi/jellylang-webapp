module Api
  module V1
    module Admin
      class UsersController < BaseController
        PER_PAGE = 50

        def index
          scope = User.all
          if params[:q].present?
            q = "%#{User.sanitize_sql_like(params[:q].strip)}%"
            scope = scope.where("users.email ILIKE :q OR users.name ILIKE :q", q: q)
          end
          scope = scope.where(admin: true) if params[:role] == "admin"
          scope = scope.where.not(disabled_at: nil) if params[:status] == "disabled"

          page = [params[:page].to_i, 1].max
          total = scope.count
          users = with_counts(scope).includes(:current_language).order(created_at: :desc).offset((page - 1) * PER_PAGE).limit(PER_PAGE)
          render json: { items: users.map { |user| user_json(user) }, total: total, page: page, per_page: PER_PAGE }
        end

        # Alta manual (necesaria si el registro está cerrado)
        def create
          user = User.new(params.permit(:email, :password, :name))
          user.admin = ActiveModel::Type::Boolean.new.cast(params[:admin]) || false
          user.email_verified_at = Time.current # lo da de alta un administrador

          User.transaction do
            user.save!
            if (language = Language.enabled.find_by(id: params[:study_language_id]))
              user.user_languages.create!(language: language)
              user.update!(current_language: language)
            end
          end
          render json: user_json(with_counts(User.where(id: user.id)).first), status: :created
        end

        # Cambia rol, estado, nombre o contraseña
        def update
          user = User.find(params[:id])
          protect_self!(user) if params.key?(:admin) || params.key?(:disabled)

          User.transaction do
            user.name = params[:name] if params.key?(:name)
            user.password = params[:password] if params[:password].present?
            user.admin = ActiveModel::Type::Boolean.new.cast(params[:admin]) if params.key?(:admin)
            if params.key?(:disabled)
              user.disabled_at = ActiveModel::Type::Boolean.new.cast(params[:disabled]) ? (user.disabled_at || Time.current) : nil
            end
            user.save!
            ensure_an_admin_remains!
          end

          render json: user_json(with_counts(User.where(id: user.id)).first)
        end

        def destroy
          user = User.find(params[:id])
          protect_self!(user)

          User.transaction do
            user.destroy!
            ensure_an_admin_remains!
          end
          head :no_content
        end

        private

        # Nadie puede quitarse el rol, desactivarse o borrarse a sí mismo: evita quedarse fuera del panel
        def protect_self!(user)
          return unless user.id == current_user.id

          raise ApiError.new(I18n.t("errors.admin.self"), code: "admin_self")
        end

        def ensure_an_admin_remains!
          return if User.admins.exists?

          raise ApiError.new(I18n.t("errors.admin.last_admin"), code: "last_admin")
        end

        def with_counts(scope)
          scope.select(
            "users.*",
            "(SELECT COUNT(*) FROM lessons WHERE lessons.user_id = users.id) AS lessons_count",
            "(SELECT COUNT(*) FROM jellies WHERE jellies.user_id = users.id) AS jellies_count",
            "(SELECT MAX(date) FROM daily_stats WHERE daily_stats.user_id = users.id) AS last_active_on"
          )
        end

        def user_json(user)
          {
            id: user.id,
            email: user.email,
            name: user.name,
            admin: user.admin,
            disabled: user.disabled?,
            email_verified: user.email_verified?,
            current_language: user.current_language&.code,
            lessons_count: user.lessons_count.to_i,
            jellies_count: user.jellies_count.to_i,
            last_active_on: user.last_active_on,
            created_at: user.created_at
          }
        end
      end
    end
  end
end
