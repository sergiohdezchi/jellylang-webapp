# Genera y envía el código para restablecer la contraseña (no se guarda en claro en Redis).
class SendPasswordResetCodeJob
  include Sidekiq::Job
  sidekiq_options queue: :mailers, retry: 3

  def perform(user_id)
    user = User.find_by(id: user_id)
    return if user.nil? || user.disabled?

    code = user.generate_code!(:reset)
    AccountMailer.with(user: user, code: code).password_reset.deliver_now
  end
end
