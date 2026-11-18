# Ajustes del sistema. Cada uno se resuelve así:
#   1. el valor guardado desde el panel de administración (tabla app_settings), si existe;
#   2. si no, la variable de entorno (útil para el primer arranque o para despliegues);
#   3. si no, el valor por defecto.
# Se leen en cada llamada para que la API y el worker vean los cambios al momento.
module Settings
  DEFINITIONS = {
    "ytdlp_enabled" => { env: "YTDLP_ENABLED", default: true },
    "signups_enabled" => { env: "SIGNUPS_ENABLED", default: true }
  }.freeze

  class UnknownSetting < StandardError; end

  module_function

  def get(key)
    resolve(key)[:value]
  end

  def set(key, value, user: nil)
    definition!(key)
    record = AppSetting.find_or_initialize_by(key: key)
    record.update!(value: cast(value), updated_by: user)
  end

  # Borra el valor del panel: vuelve a mandar la variable de entorno o el valor por defecto
  def reset(key)
    definition!(key)
    AppSetting.where(key: key).delete_all
  end

  def all
    DEFINITIONS.keys.map { |key| { key: key, **resolve(key) } }
  end

  def resolve(key)
    definition = definition!(key)
    stored = AppSetting.find_by(key: key)
    return { value: stored.value, source: "panel", env: definition[:env], updated_at: stored.updated_at } if stored

    raw = ENV[definition[:env]]
    return { value: cast(raw, definition[:default]), source: "env", env: definition[:env] } if raw.present?

    { value: definition[:default], source: "default", env: definition[:env] }
  end

  # Booleano tolerante: "false", "0", "off" => false; vacío o desconocido => valor por defecto
  def cast(value, fallback = true)
    result = ActiveModel::Type::Boolean.new.cast(value)
    result.nil? ? fallback : result
  end

  def definition!(key)
    DEFINITIONS.fetch(key.to_s) { raise UnknownSetting, key.to_s }
  end
end
