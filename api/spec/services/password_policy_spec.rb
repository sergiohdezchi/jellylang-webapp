require "rails_helper"

RSpec.describe PasswordPolicy do
  def violations(password, email: "ana@example.com") = described_class.violations(password, email: email)

  it "acepta una contraseña robusta" do
    expect(violations("Medusa-Azul-2026")).to be_empty
    expect(violations("Árbol.Verde.81")).to be_empty # letras con tilde cuentan
  end

  it "explica cada regla que falla" do
    expect(violations("abc")).to include(:password_too_short, :password_needs_uppercase, :password_needs_digit)
    expect(violations("ABCDEFGHIJ1")).to include(:password_needs_lowercase)
    expect(violations("Zzzzz-Rio-2026")).to include(:password_repeated)
    expect(violations("MiPassword2026")).to include(:password_too_common)
    expect(violations("Qwerty-Rio-2026")).to include(:password_too_common)
    expect(violations("SoyAna.Rios2026", email: "anarios@example.com")).to include(:password_contains_email)
  end

  it "genera contraseñas que cumplen las reglas" do
    5.times { expect(violations(described_class.generate)).to be_empty }
  end

  it "solo se valida al cambiar la contraseña (las cuentas antiguas siguen entrando)" do
    user = create_user
    user.update_column(:password_digest, BCrypt::Password.create("debil"))
    expect(user.reload.update(name: "Ana")).to eq(true)
  end
end
