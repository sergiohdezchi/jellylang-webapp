import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, download } from "../api/client";
import type { Lingq, Paginated } from "../api/types";
import { useLanguage } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import Icon from "../components/Icon";
import styles from "./VocabularyPage.module.scss";

const LEVELS = [1, 2, 3, 4];

export default function VocabularyPage() {
    const language = useLanguage();
    const { t } = useI18n();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [q, setQ] = useState("");
    const [level, setLevel] = useState("");
    const [kind, setKind] = useState("");
    const [page, setPage] = useState(1);

    // Búsqueda con pequeño retardo
    useEffect(() => {
        const timer = window.setTimeout(() => {
            setQ(search);
            setPage(1);
        }, 300);
        return () => window.clearTimeout(timer);
    }, [search]);

    const filters = { language_id: language.id, q, level, kind };
    const { data, isLoading } = useQuery({
        queryKey: ["lingqs", filters, page],
        queryFn: () => api<Paginated<Lingq>>("/lingqs", { query: { ...filters, page } }),
        placeholderData: keepPreviousData,
    });

    const update = useMutation({
        mutationFn: ({ id, ...changes }: { id: number; meaning?: string; level?: number }) =>
            api(`/lingqs/${id}`, { method: "PATCH", body: changes }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lingqs"] });
            queryClient.invalidateQueries({ queryKey: ["lesson"] });
        },
    });

    const markKnown = useMutation({
        mutationFn: (lingq: Lingq) =>
            api("/user_words", {
                method: "PUT",
                body: { language_id: language.id, term: lingq.term, status: lingq.status === "known" ? "learning" : "known", level: lingq.level },
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lingqs"] });
            queryClient.invalidateQueries({ queryKey: ["stats"] });
        },
    });

    const remove = useMutation({
        mutationFn: (id: number) => api(`/lingqs/${id}`, { method: "DELETE" }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["lingqs"] });
            queryClient.invalidateQueries({ queryKey: ["stats"] });
        },
    });

    const totalPages = data ? Math.max(1, Math.ceil(data.total / data.per_page)) : 1;

    return (
        <div className="container">
            <div className="page-header">
                <h1>
                    {t("vocab.title")} {data && <span className="muted">· {t("vocab.total", { count: data.total })}</span>}
                </h1>
                <div className={styles.exports}>
                    <button className="btn small" onClick={() => download("/lingqs/export", { ...filters, format_type: "csv" })}>
                        <Icon name="download" size={16} /> {t("vocab.export_csv")}
                    </button>
                    <button className="btn small" onClick={() => download("/lingqs/export", { ...filters, format_type: "anki" })}>
                        <Icon name="download" size={16} /> {t("vocab.export_anki")}
                    </button>
                </div>
            </div>

            <div className={styles.filters}>
                <input className="input" placeholder={t("vocab.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
                <select
                    className="select"
                    value={level}
                    onChange={(e) => {
                        setLevel(e.target.value);
                        setPage(1);
                    }}
                >
                    <option value="">{t("vocab.level_all")}</option>
                    {LEVELS.map((l) => (
                        <option key={l} value={l}>
                            {t("vocab.level", { level: l })}
                        </option>
                    ))}
                    <option value="known">{t("vocab.known")}</option>
                </select>
                <select
                    className="select"
                    value={kind}
                    onChange={(e) => {
                        setKind(e.target.value);
                        setPage(1);
                    }}
                >
                    <option value="">{t("vocab.kind_all")}</option>
                    <option value="word">{t("vocab.kind_word")}</option>
                    <option value="phrase">{t("vocab.kind_phrase")}</option>
                </select>
            </div>

            {isLoading ? (
                <div className="center-state">
                    <div className="spinner" />
                </div>
            ) : !data || data.items.length === 0 ? (
                <p className="center-state">{t("vocab.empty")}</p>
            ) : (
                <>
                    <ul className={styles.list}>
                        {data.items.map((lingq) => (
                            <li key={lingq.id} className={styles.item}>
                                <div className={styles.main}>
                                    <div className={styles.term}>
                                        {lingq.term}
                                        {lingq.is_phrase && <span className="badge">{t("panel.phrase")}</span>}
                                    </div>
                                    <input
                                        className={styles.meaning}
                                        defaultValue={lingq.meaning ?? ""}
                                        placeholder={t("panel.meaning_placeholder")}
                                        aria-label={t("panel.meaning")}
                                        onBlur={(e) => {
                                            const value = e.target.value.trim();
                                            if (value !== (lingq.meaning ?? "")) update.mutate({ id: lingq.id, meaning: value });
                                        }}
                                    />
                                    {lingq.context && <p className={styles.context}>{lingq.context}</p>}
                                    {lingq.lesson_id && (
                                        <Link
                                            className={styles.source}
                                            to={`/lessons/${lingq.lesson_id}${lingq.video_time ? `?t=${Math.floor(lingq.video_time)}` : ""}`}
                                        >
                                            <Icon name={lingq.youtube_id ? "video" : "book"} size={13} /> {lingq.lesson_title}
                                        </Link>
                                    )}
                                </div>
                                <div className={styles.side}>
                                    <div className={styles.levels}>
                                        {LEVELS.map((l) => (
                                            <button
                                                key={l}
                                                className={`${styles.level} ${styles[`l${l}`]} ${lingq.status === "learning" && lingq.level === l ? styles.current : ""}`}
                                                onClick={() => update.mutate({ id: lingq.id, level: l })}
                                                aria-label={t("vocab.level", { level: l })}
                                            >
                                                {l}
                                            </button>
                                        ))}
                                        <button
                                            className={`${styles.level} ${styles.known} ${lingq.status === "known" ? styles.current : ""}`}
                                            onClick={() => markKnown.mutate(lingq)}
                                            aria-label={t("panel.known")}
                                            title={t("panel.known")}
                                        >
                                            <Icon name="check" size={14} />
                                        </button>
                                    </div>
                                    <button
                                        className="btn ghost icon small"
                                        aria-label={t("common.delete")}
                                        title={t("common.delete")}
                                        onClick={() => window.confirm(t("vocab.delete_confirm", { term: lingq.term })) && remove.mutate(lingq.id)}
                                    >
                                        <Icon name="trash" size={16} />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                    {totalPages > 1 && (
                        <nav className={styles.pager}>
                            <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                                {t("common.prev")}
                            </button>
                            <span className="muted">
                                {page} / {totalPages}
                            </span>
                            <button className="btn small" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                                {t("common.next")}
                            </button>
                        </nav>
                    )}
                </>
            )}
        </div>
    );
}
