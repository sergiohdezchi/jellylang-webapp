export interface Language {
    id: number;
    code: string;
    name: string;
}

export interface StudyLanguage {
    language: Language;
    daily_goal: number;
}

export interface User {
    id: number;
    email: string;
    name: string | null;
    ui_language: "es" | "en";
    native_language: string;
    current_language: Language | null;
    languages: StudyLanguage[];
}

export type LessonStatus = "processing" | "ready" | "failed";
export type SourceType = "text" | "url" | "file" | "youtube";
export type Level = "beginner" | "intermediate" | "advanced";

export interface Lesson {
    id: number;
    title: string;
    source_type: SourceType;
    source_url: string | null;
    youtube_id: string | null;
    thumbnail_url: string | null;
    author: string | null;
    duration: number | null;
    level: Level | null;
    status: LessonStatus;
    error_message: string | null;
    word_count: number;
    progress_page: number;
    completed_at: string | null;
    language_id: number;
    course_id: number | null;
    created_at: string;
}

export interface Segment {
    id: number;
    position: number;
    paragraph: number;
    text: string;
    start: number | null;
    end: number | null;
    /** Inicio de cada palabra (subtítulos automáticos de YouTube); null donde no se conoce */
    word_times: (number | null)[] | null;
}

export type WordStatus = "new" | "learning" | "known" | "ignored";

export interface VocabEntry {
    term: string;
    status: WordStatus;
    level: number;
    lingq_id: number | null;
    meaning: string | null;
}

export interface PhraseEntry extends VocabEntry {
    lingq_id: number;
}

export interface LessonDetail extends Lesson {
    subtitle_source: "manual" | "auto" | "upload" | null;
    segments: Segment[];
    vocabulary: Record<string, VocabEntry>;
    phrases: PhraseEntry[];
}

export interface Course {
    id: number;
    title: string;
    description: string | null;
    language_id: number;
    lessons_count: number;
}

export interface Lingq {
    id: number;
    term: string;
    meaning: string | null;
    notes: string | null;
    context: string | null;
    is_phrase: boolean;
    video_time: number | null;
    lesson_id: number | null;
    lesson_title: string | null;
    youtube_id: string | null;
    status: WordStatus;
    level: number;
    next_review_at: string;
    interval: number;
    created_at: string;
}

export interface DueItem extends Lingq {
    intervals: Record<"1" | "2" | "3" | "4", number>;
}

export interface Paginated<T> {
    items: T[];
    total: number;
    page: number;
    per_page: number;
}

export interface DayStats {
    date: string;
    words_read: number;
    listening_seconds: number;
    new_lingqs: number;
    known_words: number;
    reviews: number;
}

export interface Stats {
    language_id: number;
    known_words: number;
    lingqs: number;
    due_reviews: number;
    words_read: number;
    listening_seconds: number;
    streak: number;
    daily_goal: number;
    today: DayStats;
    week: DayStats[];
}

export interface Translation {
    term: string;
    translation: string | null;
    alternatives: string[];
    provider: string;
}
