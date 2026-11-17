class AddWordTimesToSegments < ActiveRecord::Migration[8.1]
  def change
    # Inicio (en segundos) de cada palabra del segmento, alineado con Text::Tokenizer.words.
    # Puede contener null para palabras sin tiempo conocido; null si no hay ningún dato.
    add_column :segments, :word_times, :jsonb
  end
end
