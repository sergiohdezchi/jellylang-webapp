class AddAdminPanel < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :admin, :boolean, null: false, default: false
    add_column :users, :disabled_at, :datetime

    # Un idioma desactivado deja de ofrecerse para registrarse o empezar a estudiarlo,
    # pero quien ya lo estudia lo conserva.
    add_column :languages, :enabled, :boolean, null: false, default: true

    # Ajustes del sistema editables desde el panel (sobrescriben a las variables de entorno)
    create_table :app_settings do |t|
      t.string :key, null: false
      t.jsonb :value
      t.references :updated_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.timestamps
    end
    add_index :app_settings, :key, unique: true
  end
end
