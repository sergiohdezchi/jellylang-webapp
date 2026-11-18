# Interruptores de funciones, leídos del entorno en cada llamada (así se pueden probar y cambiar sin reiniciar el código).
module Features
  module_function

  # Descarga de subtítulos y metadatos con yt-dlp: el servidor consulta YouTube por su cuenta.
  # Con YTDLP_ENABLED=false esa vía queda cerrada y YouTube solo se importa con la extensión
  # del navegador (o subiendo un SRT/VTT). Por defecto está activada.
  def ytdlp_enabled?
    ActiveModel::Type::Boolean.new.cast(ENV.fetch("YTDLP_ENABLED", "true")) != false
  end
end
