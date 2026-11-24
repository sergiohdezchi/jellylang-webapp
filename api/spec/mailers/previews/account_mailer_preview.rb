# Vista previa de los correos sin enviar nada: http://localhost:3000/rails/mailers
# Añade ?locale=en a la URL para verlos en inglés.
class AccountMailerPreview < ActionMailer::Preview
  def verification_code
    AccountMailer.with(user: sample_user, code: "482913").verification_code
  end

  def password_reset
    AccountMailer.with(user: sample_user, code: "731602").password_reset
  end

  def welcome
    AccountMailer.with(user: sample_user).welcome
  end

  private

  def sample_user
    locale = params[:locale].presence_in(User::UI_LANGUAGES) || "es"
    User.new(email: "ana@example.com", name: "Ana", ui_language: locale, native_language: locale,
             current_language: Language.find_by(code: locale == "es" ? "en" : "es"))
  end
end
