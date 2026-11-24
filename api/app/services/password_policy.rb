# Reglas de contraseña. La web las repite en web/src/lib/passwordPolicy.ts para mostrarlas mientras se escribe:
# si cambias una, cambia la otra.
module PasswordPolicy
  module_function

  MIN_LENGTH = 10
  MAX_BYTES = 72 # límite de bcrypt (has_secure_password ya lo valida)

  # Palabras y secuencias que hacen fácil de adivinar una contraseña aunque cumpla el resto
  COMMON = %w[
    password passw0rd contrasena contraseña qwerty asdfgh zxcvbn azerty 123456 654321 abcdef abc123
    letmein welcome bienvenido iloveyou teamo admin administrador usuario jellylang lingq
    monkey dragon football futbol sunshine princess master superman batman
  ].freeze

  # Devuelve los códigos de las reglas que no se cumplen (vacío = contraseña válida)
  def violations(password, email: nil)
    password = password.to_s
    normalized = password.downcase
    # Sin signos: "Ana.Rios" también contiene "anarios"
    compact = normalized.gsub(/[^\p{L}\p{N}]/, "")
    local = email.to_s.split("@").first.to_s.downcase.gsub(/[^\p{L}\p{N}]/, "")

    [].tap do |errors|
      errors << :password_too_short if password.length < MIN_LENGTH
      errors << :password_needs_lowercase unless password.match?(/\p{Ll}/)
      errors << :password_needs_uppercase unless password.match?(/\p{Lu}/)
      errors << :password_needs_digit unless password.match?(/\d/)
      errors << :password_repeated if password.match?(/(.)\1{3,}/)
      errors << :password_too_common if COMMON.any? { |word| normalized.include?(word) }
      errors << :password_contains_email if local.length >= 4 && compact.include?(local)
    end
  end

  # Contraseña aleatoria que cumple las reglas (seeds en producción)
  def generate
    loop do
      candidate = SecureRandom.alphanumeric(20)
      return candidate if violations(candidate).empty?
    end
  end
end
