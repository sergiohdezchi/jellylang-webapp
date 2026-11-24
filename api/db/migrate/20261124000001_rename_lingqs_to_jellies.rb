class RenameLingqsToJellies < ActiveRecord::Migration[8.1]
  def change
    # El adaptador de PostgreSQL renombra solo los índices que siguen la convención de Rails
    # (index_<tabla>_on_<columnas>) al hacer rename_table/rename_column, así que no hace falta
    # llamar a rename_index aparte.
    rename_table :lingqs, :jellies
    rename_column :review_logs, :lingq_id, :jelly_id
    rename_column :daily_stats, :new_lingqs, :new_jellies
  end
end
