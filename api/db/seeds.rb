LANGUAGES = {
  "en" => "English", "es" => "Español", "fr" => "Français", "de" => "Deutsch",
  "it" => "Italiano", "pt" => "Português", "nl" => "Nederlands", "ru" => "Русский"
}.freeze

LANGUAGES.each do |code, name|
  Language.find_or_create_by!(code: code) { |language| language.name = name }
end

# Usuario de demostración (solo desarrollo)
if Rails.env.development?
  english = Language.find_by!(code: "en")
  user = User.find_or_initialize_by(email: "demo@linguaq.dev")
  if user.new_record?
    user.assign_attributes(name: "Demo", password: "password123", native_language: "es", current_language: english, admin: true)
    user.save!
    user.user_languages.create!(language: english, daily_goal: 20)

    course = user.courses.create!(language: english, title: "Short stories")
    lesson = user.lessons.create!(language: english, course: course, title: "The Lighthouse Keeper", source_type: "text", level: "beginner")
    lesson.replace_segments!(Text::Segmenter.call(<<~TEXT))
      Mara lived alone in a small lighthouse at the edge of a quiet island. Every evening, she climbed one hundred and twelve steps to light the great lamp.

      The work was simple, but it was important. Ships passed the island at night, and the light kept them away from the dangerous rocks.

      One stormy night, the lamp went dark. Mara could hear the wind screaming against the windows. Far away, she saw the small lights of a fishing boat moving toward the rocks.

      She did not have time to be afraid. She grabbed an old oil lantern, ran up the stairs, and held it high in the window. The boat slowly turned and moved back into safe water.

      The next morning, a young fisherman knocked on her door. He was holding a basket of fresh bread. "Thank you," he said. "You saved my brother and me."

      Mara smiled. For the first time in years, she did not feel alone.
    TEXT
  end

  puts "Usuario demo (administrador): demo@linguaq.dev / password123"
end
