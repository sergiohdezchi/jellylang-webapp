class AddGoogleToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :google_id, :string
    add_column :users, :avatar_url, :string
    add_index :users, :google_id, unique: true, where: "google_id IS NOT NULL"
  end
end
