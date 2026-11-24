# Códigos de 6 dígitos enviados por correo, para dos fines: verificar el email (:verification) y
# restablecer la contraseña (:reset). El código nunca se guarda en claro: solo su HMAC.
#
# Límites: el código caduca (15 min), admite pocos intentos (5) y, al agotarlos, la cuenta queda
# bloqueada para ese fin (LOCKOUT) antes de poder pedir otro. Entre envíos hay una espera (60 s).
module EmailVerifiable
  extend ActiveSupport::Concern

  CODE_TTL = 15.minutes
  MAX_ATTEMPTS = 5
  RESEND_COOLDOWN = 60.seconds
  LOCKOUT = 15.minutes

  COLUMNS = {
    verification: { digest: :verification_code_digest, sent_at: :verification_code_sent_at, attempts: :verification_attempts, locked: :verification_locked_until },
    reset: { digest: :reset_code_digest, sent_at: :reset_code_sent_at, attempts: :reset_attempts, locked: :reset_locked_until }
  }.freeze

  included do
    scope :unverified, -> { where(email_verified_at: nil) }
  end

  def email_verified? = email_verified_at.present?

  # Segundos de bloqueo que quedan (0 = no está bloqueado)
  def code_locked_for(purpose)
    locked = self[COLUMNS.fetch(purpose)[:locked]]
    locked ? [(locked - Time.current).ceil, 0].max : 0
  end

  # Segundos que faltan para poder pedir otro código (0 = ya se puede)
  def code_resend_in(purpose)
    sent = self[COLUMNS.fetch(purpose)[:sent_at]]
    return 0 if sent.nil?

    [(sent + RESEND_COOLDOWN - Time.current).ceil, 0].max
  end

  def code_active?(purpose)
    c = COLUMNS.fetch(purpose)
    self[c[:digest]].present? && self[c[:sent_at]]&.after?(CODE_TTL.ago) && self[c[:attempts]] < MAX_ATTEMPTS
  end

  def code_attempts_left(purpose) = [MAX_ATTEMPTS - self[COLUMNS.fetch(purpose)[:attempts]], 0].max

  # Marca la petición de un código nuevo (invalida el anterior). El código lo genera el job que envía el correo,
  # así nunca pasa en claro por Redis.
  def request_code!(purpose)
    c = COLUMNS.fetch(purpose)
    update_columns(c[:digest] => nil, c[:sent_at] => Time.current, c[:attempts] => 0)
  end

  def generate_code!(purpose)
    c = COLUMNS.fetch(purpose)
    code = format("%06d", SecureRandom.random_number(1_000_000))
    update_columns(c[:digest] => code_digest(purpose, code), c[:sent_at] => Time.current, c[:attempts] => 0)
    code
  end

  # :ok, :invalid, :expired, :locked o :too_many_attempts (este último, justo al agotar los intentos: ya queda bloqueado)
  def check_code!(purpose, code)
    c = COLUMNS.fetch(purpose)
    with_lock do
      return :locked if code_locked_for(purpose).positive?
      return :expired if self[c[:digest]].blank? || !self[c[:sent_at]]&.after?(CODE_TTL.ago)

      if ActiveSupport::SecurityUtils.secure_compare(self[c[:digest]], code_digest(purpose, code.to_s.gsub(/\D/, "")))
        update_columns(c[:digest] => nil, c[:attempts] => 0, c[:locked] => nil)
        :ok
      else
        attempts = self[c[:attempts]] + 1
        if attempts >= MAX_ATTEMPTS
          update_columns(c[:digest] => nil, c[:attempts] => 0, c[:locked] => LOCKOUT.from_now)
          :too_many_attempts
        else
          update_columns(c[:attempts] => attempts)
          :invalid
        end
      end
    end
  end

  def verify_email_code!(code)
    result = check_code!(:verification, code)
    update_columns(email_verified_at: Time.current) if result == :ok
    result
  end

  private

  def code_digest(purpose, code)
    OpenSSL::HMAC.hexdigest("SHA256", Rails.application.secret_key_base, "#{purpose}:#{id}:#{code}")
  end
end
