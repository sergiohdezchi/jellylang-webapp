class CreateCoreTables < ActiveRecord::Migration[8.1]
  def change
    create_table :languages do |t|
      t.string :code, null: false
      t.string :name, null: false
      t.timestamps
    end
    add_index :languages, :code, unique: true

    create_table :users do |t|
      t.string :email, null: false
      t.string :name
      t.string :password_digest, null: false
      t.string :ui_language, null: false, default: "es"
      t.string :native_language, null: false, default: "es"
      t.references :current_language, foreign_key: { to_table: :languages }
      t.timestamps
    end
    add_index :users, "lower(email)", unique: true, name: "index_users_on_lower_email"

    create_table :user_languages do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.references :language, null: false, foreign_key: true
      t.integer :daily_goal, null: false, default: 20
      t.timestamps
    end
    add_index :user_languages, %i[user_id language_id], unique: true

    create_table :courses do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.references :language, null: false, foreign_key: true
      t.string :title, null: false
      t.text :description
      t.timestamps
    end

    create_table :lessons do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.references :language, null: false, foreign_key: true
      t.references :course, foreign_key: { on_delete: :nullify }
      t.string :title, null: false
      t.string :source_type, null: false
      t.string :source_url
      t.string :youtube_id
      t.string :thumbnail_url
      t.string :author
      t.integer :duration
      t.string :level
      t.string :status, null: false, default: "ready"
      t.string :subtitle_source
      t.text :error_message
      t.integer :word_count, null: false, default: 0
      t.integer :progress_page, null: false, default: 0
      t.datetime :completed_at
      t.datetime :last_opened_at
      t.timestamps
    end
    add_index :lessons, %i[user_id language_id created_at]

    create_table :segments do |t|
      t.references :lesson, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.integer :position, null: false
      t.integer :paragraph, null: false, default: 0
      t.text :text, null: false
      t.float :start_time
      t.float :end_time
    end
    add_index :segments, %i[lesson_id position], unique: true
  end
end
