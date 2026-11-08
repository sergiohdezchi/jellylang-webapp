# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_11_07_000002) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "courses", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "language_id", null: false
    t.string "title", null: false
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["language_id"], name: "index_courses_on_language_id"
    t.index ["user_id"], name: "index_courses_on_user_id"
  end

  create_table "daily_stats", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "language_id", null: false
    t.date "date", null: false
    t.integer "words_read", default: 0, null: false
    t.integer "listening_seconds", default: 0, null: false
    t.integer "new_lingqs", default: 0, null: false
    t.integer "known_words", default: 0, null: false
    t.integer "reviews", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["language_id"], name: "index_daily_stats_on_language_id"
    t.index ["user_id", "language_id", "date"], name: "index_daily_stats_on_user_id_and_language_id_and_date", unique: true
  end

  create_table "languages", force: :cascade do |t|
    t.string "code", null: false
    t.string "name", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["code"], name: "index_languages_on_code", unique: true
  end

  create_table "lessons", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "language_id", null: false
    t.bigint "course_id"
    t.string "title", null: false
    t.string "source_type", null: false
    t.string "source_url"
    t.string "youtube_id"
    t.string "thumbnail_url"
    t.string "author"
    t.integer "duration"
    t.string "level"
    t.string "status", default: "ready", null: false
    t.string "subtitle_source"
    t.text "error_message"
    t.integer "word_count", default: 0, null: false
    t.integer "progress_page", default: 0, null: false
    t.datetime "completed_at"
    t.datetime "last_opened_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["course_id"], name: "index_lessons_on_course_id"
    t.index ["language_id"], name: "index_lessons_on_language_id"
    t.index ["user_id", "language_id", "created_at"], name: "index_lessons_on_user_id_and_language_id_and_created_at"
    t.index ["user_id"], name: "index_lessons_on_user_id"
  end

  create_table "lingqs", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "word_id", null: false
    t.bigint "language_id", null: false
    t.bigint "lesson_id"
    t.bigint "segment_id"
    t.text "meaning"
    t.text "notes"
    t.text "context"
    t.float "video_time"
    t.boolean "is_phrase", default: false, null: false
    t.datetime "next_review_at", null: false
    t.float "interval", default: 0.0, null: false
    t.float "ease", default: 2.5, null: false
    t.integer "repetitions", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["language_id"], name: "index_lingqs_on_language_id"
    t.index ["lesson_id"], name: "index_lingqs_on_lesson_id"
    t.index ["segment_id"], name: "index_lingqs_on_segment_id"
    t.index ["user_id", "next_review_at"], name: "index_lingqs_on_user_id_and_next_review_at"
    t.index ["user_id", "word_id"], name: "index_lingqs_on_user_id_and_word_id", unique: true
    t.index ["word_id"], name: "index_lingqs_on_word_id"
  end

  create_table "review_logs", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "lingq_id", null: false
    t.integer "rating", null: false
    t.datetime "reviewed_at", null: false
    t.index ["lingq_id"], name: "index_review_logs_on_lingq_id"
    t.index ["user_id"], name: "index_review_logs_on_user_id"
  end

  create_table "segments", force: :cascade do |t|
    t.bigint "lesson_id", null: false
    t.integer "position", null: false
    t.integer "paragraph", default: 0, null: false
    t.text "text", null: false
    t.float "start_time"
    t.float "end_time"
    t.index ["lesson_id", "position"], name: "index_segments_on_lesson_id_and_position", unique: true
  end

  create_table "user_languages", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "language_id", null: false
    t.integer "daily_goal", default: 20, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["language_id"], name: "index_user_languages_on_language_id"
    t.index ["user_id", "language_id"], name: "index_user_languages_on_user_id_and_language_id", unique: true
    t.index ["user_id"], name: "index_user_languages_on_user_id"
  end

  create_table "user_words", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "word_id", null: false
    t.string "status", null: false
    t.integer "level", default: 1, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id", "word_id"], name: "index_user_words_on_user_id_and_word_id", unique: true
    t.index ["word_id"], name: "index_user_words_on_word_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", null: false
    t.string "name"
    t.string "password_digest", null: false
    t.string "ui_language", default: "es", null: false
    t.string "native_language", default: "es", null: false
    t.bigint "current_language_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index "lower((email)::text)", name: "index_users_on_lower_email", unique: true
    t.index ["current_language_id"], name: "index_users_on_current_language_id"
  end

  create_table "words", force: :cascade do |t|
    t.bigint "language_id", null: false
    t.string "term", null: false
    t.string "lemma"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["language_id", "term"], name: "index_words_on_language_id_and_term", unique: true
  end

  add_foreign_key "courses", "languages"
  add_foreign_key "courses", "users", on_delete: :cascade
  add_foreign_key "daily_stats", "languages"
  add_foreign_key "daily_stats", "users", on_delete: :cascade
  add_foreign_key "lessons", "courses", on_delete: :nullify
  add_foreign_key "lessons", "languages"
  add_foreign_key "lessons", "users", on_delete: :cascade
  add_foreign_key "lingqs", "languages"
  add_foreign_key "lingqs", "lessons", on_delete: :nullify
  add_foreign_key "lingqs", "segments", on_delete: :nullify
  add_foreign_key "lingqs", "users", on_delete: :cascade
  add_foreign_key "lingqs", "words", on_delete: :cascade
  add_foreign_key "review_logs", "lingqs", on_delete: :cascade
  add_foreign_key "review_logs", "users", on_delete: :cascade
  add_foreign_key "segments", "lessons", on_delete: :cascade
  add_foreign_key "user_languages", "languages"
  add_foreign_key "user_languages", "users", on_delete: :cascade
  add_foreign_key "user_words", "users", on_delete: :cascade
  add_foreign_key "user_words", "words", on_delete: :cascade
  add_foreign_key "users", "languages", column: "current_language_id"
  add_foreign_key "words", "languages"
end
