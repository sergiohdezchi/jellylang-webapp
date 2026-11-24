class ApplicationMailer < ActionMailer::Base
  default from: -> { Mailing.from }
  layout "mailer"

  helper_method :app_url

  private

  def app_url = Mailing.app_url
end
