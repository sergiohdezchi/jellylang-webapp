# Mailing vive en app/services, que no se puede autocargar dentro de un initializer: se configura en to_prepare.
Rails.application.config.to_prepare do
  next if Rails.env.test? # test.rb usa el método :test

  ActionMailer::Base.raise_delivery_errors = true # los fallos llegan a Sidekiq, que reintenta

  if Mailing.smtp_configured?
    ActionMailer::Base.delivery_method = :smtp
    ActionMailer::Base.smtp_settings = Mailing.smtp_settings
  elsif Rails.env.development?
    # Fuera de Docker y sin SMTP_ADDRESS, los correos se guardan en tmp/mails
    ActionMailer::Base.delivery_method = :file
    ActionMailer::Base.file_settings = { location: Rails.root.join("tmp/mails").to_s }
  else
    Rails.logger.warn("[mail] SMTP sin configurar: no se envían correos y el registro no pide verificar el email")
  end
end
