# Correos de la cuenta, en el idioma de la interfaz del usuario.
class AccountMailer < ApplicationMailer
  # Código para terminar el registro
  def verification_code
    @user = params.fetch(:user)
    @code = params.fetch(:code)
    @minutes = (EmailVerifiable::CODE_TTL / 60).to_i

    I18n.with_locale(@user.ui_language) do
      @preheader = I18n.t("mailers.verification.preheader", minutes: @minutes)
      mail(to: @user.email, subject: I18n.t("mailers.verification.subject", code: @code))
    end
  end

  # Código para restablecer la contraseña
  def password_reset
    @user = params.fetch(:user)
    @code = params.fetch(:code)
    @minutes = (EmailVerifiable::CODE_TTL / 60).to_i

    I18n.with_locale(@user.ui_language) do
      @preheader = I18n.t("mailers.password_reset.preheader", minutes: @minutes)
      mail(to: @user.email, subject: I18n.t("mailers.password_reset.subject", code: @code))
    end
  end

  # Bienvenida, cuando ya verificó el email
  def welcome
    @user = params.fetch(:user)

    I18n.with_locale(@user.ui_language) do
      @name = @user.name.presence
      @language = (language = @user.current_language) && I18n.t("languages.#{language.code}", default: language.name)
      @preheader = I18n.t("mailers.welcome.preheader")
      mail(to: @user.email, subject: I18n.t("mailers.welcome.subject"))
    end
  end
end
