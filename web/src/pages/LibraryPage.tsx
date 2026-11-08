import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Lesson } from "../api/types";
import { useLanguage } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { useCourses } from "../hooks/useCourses";
import { formatClock, formatNumber } from "../lib/format";
import Icon, { type IconName } from "../components/Icon";
import styles from "./LibraryPage.module.scss";

const SOURCE_ICONS: Record<Lesson["source_type"], IconName> = {
    text: "text",
    url: "link",
    file: "file",
    youtube: "video",
};

export default function LibraryPage() {
    const language = useLanguage();
    const { t, locale } = useI18n();
    const queryClient = useQueryClient();
    const [q, setQ] = useState("");
    const [courseId, setCourseId] = useState<number | null>(null);
    const [level, setLevel] = useState("");
    const [newCourse, setNewCourse] = useState<string | null>(null);

    const { data: courses = [] } = useCourses();
    const { data: lessons, isLoading } = useQuery({
        queryKey: ["lessons", language.id],
        queryFn: () => api<Lesson[]>("/lessons", { query: { language_id: language.id } }),
        refetchInterval: (query) => (query.state.data?.some((l) => l.status === "processing") ? 2000 : false),
    });

    const deleteLesson = useMutation({
        mutationFn: (id: number) => api(`/lessons/${id}`, { method: "DELETE" }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lessons"] });
            queryClient.invalidateQueries({ queryKey: ["courses"] });
        },
    });

    const createCourse = useMutation({
        mutationFn: (title: string) => api("/courses", { method: "POST", body: { title, language_id: language.id } }),
        onSuccess: () => {
            setNewCourse(null);
            queryClient.invalidateQueries({ queryKey: ["courses"] });
        },
    });

    const deleteCourse = useMutation({
        mutationFn: (id: number) => api(`/courses/${id}`, { method: "DELETE" }),
        onSuccess: () => {
            setCourseId(null);
            queryClient.invalidateQueries({ queryKey: ["courses"] });
            queryClient.invalidateQueries({ queryKey: ["lessons"] });
        },
    });

    const filtered = (lessons ?? []).filter(
        (lesson) =>
            (!courseId || lesson.course_id === courseId) &&
            (!level || lesson.level === level) &&
            (!q || lesson.title.toLowerCase().includes(q.toLowerCase())),
    );
    const selectedCourse = courses.find((c) => c.id === courseId);

    return (
        <div className="container">
            <div className="page-header">
                <h1>
                    {t("library.title")} <span className="muted">· {language.name}</span>
                </h1>
                <Link to={courseId ? `/import?course=${courseId}` : "/import"} className="btn primary">
                    <Icon name="plus" /> {t("nav.import")}
                </Link>
            </div>

            <div className={styles.toolbar}>
                <label className={styles.search}>
                    <Icon name="search" />
                    <input className="input" placeholder={t("library.search")} value={q} onChange={(e) => setQ(e.target.value)} />
                </label>
                <select className="select" value={level} onChange={(e) => setLevel(e.target.value)} aria-label={t("import.level")}>
                    <option value="">{t("level.any")}</option>
                    <option value="beginner">{t("level.beginner")}</option>
                    <option value="intermediate">{t("level.intermediate")}</option>
                    <option value="advanced">{t("level.advanced")}</option>
                </select>
            </div>

            <div className={styles.courses}>
                <button className={`btn small ${courseId === null ? "active" : ""}`} onClick={() => setCourseId(null)}>
                    {t("library.all_courses")}
                </button>
                {courses.map((course) => (
                    <button key={course.id} className={`btn small ${courseId === course.id ? "active" : ""}`} onClick={() => setCourseId(course.id)}>
                        {course.title} <span className="muted">{course.lessons_count}</span>
                    </button>
                ))}
                {newCourse === null ? (
                    <button className="btn small ghost" onClick={() => setNewCourse("")}>
                        <Icon name="plus" size={14} /> {t("library.new_course")}
                    </button>
                ) : (
                    <form
                        className={styles.courseForm}
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (newCourse.trim()) createCourse.mutate(newCourse.trim());
                        }}
                    >
                        <input
                            className="input"
                            autoFocus
                            placeholder={t("library.course_name")}
                            value={newCourse}
                            onChange={(e) => setNewCourse(e.target.value)}
                            onKeyDown={(e) => e.key === "Escape" && setNewCourse(null)}
                        />
                        <button className="btn small primary">{t("common.save")}</button>
                    </form>
                )}
                {selectedCourse && (
                    <button
                        className="btn small ghost danger"
                        onClick={() => window.confirm(t("library.delete_course_confirm", { title: selectedCourse.title })) && deleteCourse.mutate(selectedCourse.id)}
                    >
                        <Icon name="trash" size={14} /> {t("common.delete")}
                    </button>
                )}
            </div>

            {isLoading ? (
                <div className="center-state">
                    <div className="spinner" />
                </div>
            ) : lessons && lessons.length === 0 ? (
                <div className={`card ${styles.empty}`}>
                    <Icon name="book" size={40} />
                    <h2>{t("library.empty_title")}</h2>
                    <p className="muted">{t("library.empty_text")}</p>
                    <Link to="/import" className="btn primary">
                        <Icon name="plus" /> {t("nav.import")}
                    </Link>
                </div>
            ) : filtered.length === 0 ? (
                <p className="center-state">{t("library.no_results")}</p>
            ) : (
                <div className={styles.grid}>
                    {filtered.map((lesson) => (
                        <article key={lesson.id} className={styles.card}>
                            <Link to={`/lessons/${lesson.id}`} className={styles.cover}>
                                {lesson.thumbnail_url ? (
                                    <img src={lesson.thumbnail_url} alt="" loading="lazy" />
                                ) : (
                                    <div className={styles.placeholder} data-source={lesson.source_type}>
                                        <Icon name={SOURCE_ICONS[lesson.source_type]} size={32} />
                                    </div>
                                )}
                                {lesson.duration ? <span className={styles.duration}>{formatClock(lesson.duration)}</span> : null}
                                {lesson.status === "processing" && (
                                    <div className={styles.overlay}>
                                        <div className="spinner" /> {t("library.processing")}
                                    </div>
                                )}
                            </Link>
                            <div className={styles.body}>
                                <Link to={`/lessons/${lesson.id}`} className={styles.title}>
                                    {lesson.title}
                                </Link>
                                <div className={styles.meta}>
                                    <span className="badge">
                                        <Icon name={SOURCE_ICONS[lesson.source_type]} size={12} /> {t(`source.${lesson.source_type}`)}
                                    </span>
                                    {lesson.level && <span className="badge">{t(`level.${lesson.level}`)}</span>}
                                    {lesson.status === "failed" && <span className="badge danger">{t("library.failed")}</span>}
                                    {lesson.completed_at && (
                                        <span className="badge accent">
                                            <Icon name="check" size={12} /> {t("library.completed")}
                                        </span>
                                    )}
                                </div>
                                <div className={styles.footer}>
                                    <span className="muted">{t("common.words", { count: formatNumber(lesson.word_count, locale) })}</span>
                                    <button
                                        className="btn ghost icon small"
                                        aria-label={t("common.delete")}
                                        title={t("common.delete")}
                                        onClick={() => window.confirm(t("library.delete_confirm", { title: lesson.title })) && deleteLesson.mutate(lesson.id)}
                                    >
                                        <Icon name="trash" size={16} />
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
