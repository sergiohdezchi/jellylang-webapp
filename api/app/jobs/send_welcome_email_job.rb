# Envía la bienvenida fuera de la petición: un fallo de SMTP nunca rompe el registro, y Sidekiq reintenta.
class SendWelcomeEmailJob
  include Sidekiq::Job
  sidekiq_options queue: :mailers, retry: 5

  def perform(user_id)
    user = User.find_by(id: user_id)
    return if user.nil? || user.disabled?

    AccountMailer.with(user: user).welcome.deliver_now
  end
end
