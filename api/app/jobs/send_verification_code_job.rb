# Genera el código y lo envía. Se genera aquí (y no en la petición) para que no se guarde en claro en Redis.
class SendVerificationCodeJob
  include Sidekiq::Job
  sidekiq_options queue: :mailers, retry: 3

  def perform(user_id)
    user = User.find_by(id: user_id)
    return if user.nil? || user.email_verified? || user.disabled?

    code = user.generate_code!(:verification)
    AccountMailer.with(user: user, code: code).verification_code.deliver_now
  end
end
