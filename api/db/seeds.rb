LANGUAGES = {
  "en" => "English", "es" => "Español", "fr" => "Français", "de" => "Deutsch",
  "it" => "Italiano", "pt" => "Português", "nl" => "Nederlands", "ru" => "Русский"
}.freeze

LANGUAGES.each do |code, name|
  Language.find_or_create_by!(code: code) { |language| language.name = name }
end

# ---------------------------------------------------------------------------------------------
# Usuarios iniciales. Es seguro ejecutarlo varias veces: solo crea lo que falta y nunca cambia la
# contraseña de un usuario que ya existe.
#
#   ADMIN_EMAIL / ADMIN_PASSWORD      administrador
#   EXAMPLE_EMAIL / EXAMPLE_PASSWORD  usuario de ejemplo (habla español, aprende inglés)
#
# En desarrollo y pruebas las contraseñas por defecto son "Medusa-Azul-2026". En producción no hay
# contraseñas por defecto: si no defines la variable, se genera una aleatoria y se muestra una sola vez.
# ---------------------------------------------------------------------------------------------
DEFAULT_PASSWORD = "Medusa-Azul-2026".freeze

def seed_credentials(prefix, default_email)
  email = ENV["#{prefix}_EMAIL"].presence || default_email
  password = ENV["#{prefix}_PASSWORD"].presence
  generated = false
  if password.nil?
    if Rails.env.production?
      password = PasswordPolicy.generate
      generated = true
    else
      password = DEFAULT_PASSWORD
    end
  end
  [email, password, generated]
end

def seed_user(label, prefix, default_email, name:, admin:)
  email, password, generated = seed_credentials(prefix, default_email)
  user = User.find_by("lower(email) = ?", email.downcase)
  if user
    puts "#{label}: #{email} ya existe, no se modifica"
    return [user, false]
  end

  english = Language.find_by!(code: "en")
  user = User.create!(email: email, name: name, password: password, native_language: "es", ui_language: "es",
                      current_language: english, admin: admin, email_verified_at: Time.current)
  user.user_languages.create!(language: english, daily_goal: 20)
  puts "#{label}: #{email} / #{password}#{' (contraseña generada: guárdala, no se vuelve a mostrar)' if generated}"
  [user, true]
end

seed_user("Administrador", "ADMIN", "admin@jellylang.com", name: "Admin", admin: true)

example, created = seed_user("Usuario de ejemplo", "EXAMPLE", "example@jellylang.com", name: "Ejemplo", admin: false)

if created
  english = Language.find_by!(code: "en")
  course = example.courses.create!(language: english, title: "Short stories")
  lesson = example.lessons.create!(language: english, course: course, title: "The Lighthouse Keeper", source_type: "text", level: "beginner")
  lesson.replace_segments!(Text::Segmenter.call(<<~TEXT))
      Mara lived alone in a small lighthouse at the edge of a quiet island. Every evening, she climbed one hundred and twelve steps to light the great lamp.

      The work was simple, but it was important. Ships passed the island at night, and the light kept them away from the dangerous rocks.

      One stormy night, the lamp went dark. Mara could hear the wind screaming against the windows. Far away, she saw the small lights of a fishing boat moving toward the rocks.

      She did not have time to be afraid. She grabbed an old oil lantern, ran up the stairs, and held it high in the window. The boat slowly turned and moved back into safe water.

      The next morning, a young fisherman knocked on her door. He was holding a basket of fresh bread. "Thank you," he said. "You saved my brother and me."

      Mara smiled. For the first time in years, she did not feel alone.
  TEXT
end
