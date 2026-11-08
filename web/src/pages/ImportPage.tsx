import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Lesson } from "../api/types";
import { useLanguage } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { useCourses } from "../hooks/useCourses";
import Icon, { type IconName } from "../components/Icon";
import styles from "./ImportPage.module.scss";

type Mode = "text" | "url" | "file" | "youtube";

const MODES: { mode: Mode; icon: IconName }[] = [
    { mode: "youtube", icon: "video" },
    { mode: "text", icon: "text" },
    { mode: "url", icon: "link" },
    { mode: "file", icon: "file" },
];

export default function ImportPage() {
    const language = useLanguage();
    const { t } = useI18n();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [params] = useSearchParams();
    const { data: courses = [] } = useCourses();

    const [mode, setMode] = useState<Mode>("youtube");
    const [title, setTitle] = useState("");
    const [courseId, setCourseId] = useState(params.get("course") ?? "");
    const [level, setLevel] = useState("");
    const [content, setContent] = useState("");
    const [url, setUrl] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        setError(null);

        const common = { language_id: language.id, title, course_id: courseId, level };
        try {
            let lesson: Lesson;
            if (mode === "youtube") {
                lesson = await api<Lesson>("/lessons/youtube", { method: "POST", body: { ...common, url } });
            } else if (mode === "file") {
                const data = new FormData();
                Object.entries(common).forEach(([key, value]) => data.append(key, String(value)));
                data.append("source_type", "file");
                if (file) data.append("file", file);
                lesson = await api<Lesson>("/lessons", { method: "POST", body: data });
            } else {
                lesson = await api<Lesson>("/lessons", { method: "POST", body: { ...common, source_type: mode, content, url } });
            }
            queryClient.invalidateQueries({ queryKey: ["lessons"] });
            queryClient.invalidateQueries({ queryKey: ["courses"] });
            navigate(`/lessons/${lesson.id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : t("common.error"));
            setBusy(false);
        }
    }

    return (
        <div className="container">
            <div className={styles.wrapper}>
                <div className="page-header">
                    <h1>{t("import.title")}</h1>
                </div>

                <div className="tabs" role="tablist">
                    {MODES.map(({ mode: m, icon }) => (
                        <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? "active" : ""} onClick={() => setMode(m)}>
                            <Icon name={icon} size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
                            {t(`source.${m}`)}
                        </button>
                    ))}
                </div>

                <form className="card" onSubmit={handleSubmit}>
                    {error && <div className="alert error">{error}</div>}

                    {mode === "youtube" && (
                        <label className="field">
                            <span>{t("import.youtube_url")}</span>
                            <input
                                className="input"
                                type="url"
                                required
                                placeholder="https://www.youtube.com/watch?v=…"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                            />
                            <small className="muted">{t("import.youtube_hint", { language: language.name })}</small>
                        </label>
                    )}

                    {mode === "url" && (
                        <label className="field">
                            <span>{t("import.url")}</span>
                            <input className="input" type="url" required placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
                            <small className="muted">{t("import.url_hint")}</small>
                        </label>
                    )}

                    {mode === "file" && (
                        <label className="field">
                            <span>{t("import.file")}</span>
                            <input className="input" type="file" required accept=".txt,.md,.srt,.vtt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                            <small className="muted">{t("import.file_hint")}</small>
                        </label>
                    )}

                    <label className="field">
                        <span>{t("import.lesson_title")}</span>
                        <input
                            className="input"
                            required={mode === "text"}
                            placeholder={mode === "text" ? "" : t("import.title_optional")}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </label>

                    {mode === "text" && (
                        <label className="field">
                            <span>{t("import.content")}</span>
                            <textarea
                                className={`textarea ${styles.content}`}
                                required
                                placeholder={t("import.content_placeholder")}
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                            />
                        </label>
                    )}

                    <div className="form-row">
                        <label className="field">
                            <span>{t("import.course")}</span>
                            <select className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                                <option value="">{t("import.no_course")}</option>
                                {courses.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.title}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="field">
                            <span>{t("import.level")}</span>
                            <select className="select" value={level} onChange={(e) => setLevel(e.target.value)}>
                                <option value="">{t("import.no_level")}</option>
                                <option value="beginner">{t("level.beginner")}</option>
                                <option value="intermediate">{t("level.intermediate")}</option>
                                <option value="advanced">{t("level.advanced")}</option>
                            </select>
                        </label>
                    </div>

                    <div className={styles.actions}>
                        <span className="muted">{t("import.language_note", { language: language.name })}</span>
                        <button className="btn primary" disabled={busy}>
                            {busy ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Icon name="upload" />}
                            {busy ? t("import.submitting") : t("import.submit")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
