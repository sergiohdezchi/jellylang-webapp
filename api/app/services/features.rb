# Interruptores de funciones. Su valor vive en Settings (panel de administración > variable de entorno > defecto).
module Features
  module_function

  # Descarga de subtítulos y metadatos con yt-dlp: el servidor consulta YouTube por su cuenta.
  # Apagada, YouTube solo se importa con la extensión del navegador (o subiendo un SRT/VTT).
  def ytdlp_enabled?
    Settings.get("ytdlp_enabled")
  end

  # Si cualquiera puede crear una cuenta. Con una base de datos vacía siempre se permite (primer usuario).
  def signups_enabled?
    Settings.get("signups_enabled") || !User.exists?
  end
end
