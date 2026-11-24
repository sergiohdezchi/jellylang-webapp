module JsonWebToken
  ALGORITHM = "HS256".freeze
  TTL = 30.days

  module_function

  def encode(user_id)
    JWT.encode({ sub: user_id, iat: Time.current.to_i, exp: TTL.from_now.to_i }, secret, ALGORITHM)
  end

  def decode(token)
    JWT.decode(token, secret, true, algorithm: ALGORITHM).first
  rescue JWT::DecodeError
    nil
  end

  def secret
    ENV["JWT_SECRET"].presence || Rails.application.secret_key_base
  end
end
