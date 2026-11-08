class CreateVocabularyTables < ActiveRecord::Migration[8.1]
  def change
    create_table :words do |t|
      t.references :language, null: false, foreign_key: true, index: false
      t.string :term, null: false
      t.string :lemma
      t.timestamps
    end
    add_index :words, %i[language_id term], unique: true

    create_table :user_words do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :word, null: false, foreign_key: { on_delete: :cascade }
      t.string :status, null: false
      t.integer :level, null: false, default: 1
      t.timestamps
    end
    add_index :user_words, %i[user_id word_id], unique: true

    create_table :lingqs do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :word, null: false, foreign_key: { on_delete: :cascade }
      t.references :language, null: false, foreign_key: true
      t.references :lesson, foreign_key: { on_delete: :nullify }
      t.references :segment, foreign_key: { on_delete: :nullify }
      t.text :meaning
      t.text :notes
      t.text :context
      t.float :video_time
      t.boolean :is_phrase, null: false, default: false
      t.datetime :next_review_at, null: false
      t.float :interval, null: false, default: 0
      t.float :ease, null: false, default: 2.5
      t.integer :repetitions, null: false, default: 0
      t.timestamps
    end
    add_index :lingqs, %i[user_id word_id], unique: true
    add_index :lingqs, %i[user_id next_review_at]

    create_table :review_logs do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.references :lingq, null: false, foreign_key: { on_delete: :cascade }
      t.integer :rating, null: false
      t.datetime :reviewed_at, null: false
    end

    create_table :daily_stats do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :language, null: false, foreign_key: true
      t.date :date, null: false
      t.integer :words_read, null: false, default: 0
      t.integer :listening_seconds, null: false, default: 0
      t.integer :new_lingqs, null: false, default: 0
      t.integer :known_words, null: false, default: 0
      t.integer :reviews, null: false, default: 0
      t.timestamps
    end
    add_index :daily_stats, %i[user_id language_id date], unique: true
  end
end
