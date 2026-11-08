import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { DueItem } from "../api/types";
import { useLanguage } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { useStoredState } from "../hooks/useStoredState";
import { formatInterval } from "../lib/format";
import { normalizeTerm, tokenize } from "../lib/tokenize";
import Icon from "../components/Icon";
import styles from "./ReviewPage.module.scss";

type Mode = "cards" | "write";
type Rating = 1 | 2 | 3 | 4;

const RATINGS: { rating: Rating; key: "review.again" | "review.hard" | "review.good" | "review.easy" }[] = [
    { rating: 1, key: "review.again" },
    { rating: 2, key: "review.hard" },
    { rating: 3, key: "review.good" },
    { rating: 4, key: "review.easy" },
];

export default function ReviewPage() {
    const language = useLanguage();
    const { t } = useI18n();
    const queryClient = useQueryClient();
    const [mode, setMode] = useStoredState<Mode>("linguaq.reviewMode", "cards");
    const [queue, setQueue] = useState<DueItem[] | null>(null);
    const [revealed, setRevealed] = useState(false);
    const [answer, setAnswer] = useState("");
    const [correct, setCorrect] = useState<boolean | null>(null);
    const [reviewed, setReviewed] = useState(0);
    const [busy, setBusy] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const { data, isLoading, refetch } = useQuery({
        queryKey: ["reviews", language.id],
        queryFn: () => api<{ total: number; items: DueItem[] }>("/reviews/due", { query: { language_id: language.id } }),
        staleTime: 0,
    });

    useEffect(() => {
        if (data && queue === null) setQueue(data.items);
    }, [data, queue]);

    const card = queue?.[0];

    useEffect(() => {
        setRevealed(false);
        setAnswer("");
        setCorrect(null);
        if (mode === "write") inputRef.current?.focus();
    }, [card?.id, mode]);

    async function rate(rating: Rating) {
        if (!card || busy) return;
        setBusy(true);
        try {
            await api("/reviews", { method: "POST", body: { lingq_id: card.id, rating } });
            setReviewed((n) => n + 1);
            // "Otra vez" vuelve al final de la cola de esta sesión
            setQueue((q) => (q ? (rating === 1 ? [...q.slice(1), q[0]] : q.slice(1)) : q));
            queryClient.invalidateQueries({ queryKey: ["stats"] });
            queryClient.invalidateQueries({ queryKey: ["lingqs"] });
        } finally {
            setBusy(false);
        }
    }

    function check(event: FormEvent) {
        event.preventDefault();
        if (!card) return;
        setCorrect(normalizeTerm(answer) === card.term);
        setRevealed(true);
    }

    const actions = useRef({ rate, revealed, setRevealed, mode });
    actions.current = { rate, revealed, setRevealed, mode };
    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if ((event.target as HTMLElement).closest("input, textarea, select")) return;
            const { revealed: isRevealed, mode: m } = actions.current;
            if (!isRevealed && m === "cards" && (event.key === " " || event.key === "Enter")) {
                event.preventDefault();
                actions.current.setRevealed(true);
            } else if (isRevealed && ["1", "2", "3", "4"].includes(event.key)) {
                actions.current.rate(Number(event.key) as Rating);
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    function speak(text: string) {
        if (!("speechSynthesis" in window)) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language.code;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }

    if (isLoading || queue === null) {
        return (
            <div className="center-state">
                <div className="spinner" />
            </div>
        );
    }

    if (!card) {
        return (
            <div className="container">
                <div className={`card ${styles.finished}`}>
                    <Icon name={reviewed > 0 ? "check" : "cards"} size={44} />
                    <h1>{reviewed > 0 ? t("review.done_title") : t("review.empty_title")}</h1>
                    <p className="muted">{reviewed > 0 ? t("review.done_text", { count: reviewed }) : t("review.empty_text")}</p>
                    <div className={styles.finishedActions}>
                        {reviewed > 0 && (
                            <button
                                className="btn"
                                onClick={async () => {
                                    const fresh = await refetch();
                                    setQueue(fresh.data?.items ?? []);
                                }}
                            >
                                {t("review.continue")}
                            </button>
                        )}
                        <Link to="/" className="btn primary">
                            {t("nav.library")}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // En escritura se oculta el término dentro del contexto
    const terms = new Set(card.term.split(" "));
    const context = card.context
        ? tokenize(card.context).map((token, i) => {
              const hit = token.kind === "word" && terms.has(token.term);
              if (!hit) return <span key={i}>{token.text}</span>;
              return mode === "write" && !revealed ? (
                  <span key={i} className={styles.blank}>
                      {"_".repeat(Math.min(token.text.length, 10))}
                  </span>
              ) : (
                  <mark key={i}>{token.text}</mark>
              );
          })
        : null;

    return (
        <div className="container">
            <div className={styles.wrapper}>
                <div className="page-header">
                    <h1>{t("review.title")}</h1>
                    <span className="muted">{t("review.remaining", { count: queue.length })}</span>
                </div>

                <div className="tabs">
                    <button className={mode === "cards" ? "active" : ""} onClick={() => setMode("cards")}>
                        {t("review.mode_cards")}
                    </button>
                    <button className={mode === "write" ? "active" : ""} onClick={() => setMode("write")}>
                        {t("review.mode_write")}
                    </button>
                </div>

                <div className={`card ${styles.flashcard}`}>
                    {mode === "cards" || revealed ? (
                        <div className={styles.front}>
                            <h2 className={styles.term}>{card.term}</h2>
                            <button className="btn ghost icon" onClick={() => speak(card.term)} aria-label={t("panel.listen")}>
                                <Icon name="speaker" />
                            </button>
                        </div>
                    ) : (
                        <div className={styles.front}>
                            <h2 className={styles.prompt}>{card.meaning || t("review.no_meaning")}</h2>
                        </div>
                    )}

                    {context && <p className={styles.context}>{context}</p>}

                    {mode === "write" && !revealed && (
                        <form className={styles.writeForm} onSubmit={check}>
                            <input
                                ref={inputRef}
                                className="input"
                                placeholder={t("review.type_answer")}
                                value={answer}
                                onChange={(e) => setAnswer(e.target.value)}
                                autoComplete="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                lang={language.code}
                            />
                            <button className="btn primary">{t("review.check")}</button>
                        </form>
                    )}

                    {revealed && (
                        <div className={styles.answer}>
                            {correct !== null && (
                                <div className={`alert ${correct ? "info" : "error"}`}>
                                    {correct ? t("review.correct") : t("review.incorrect", { term: card.term })}
                                </div>
                            )}
                            <p className={styles.meaning}>{card.meaning || t("review.no_meaning")}</p>
                            {card.lesson_id && (
                                <Link
                                    to={`/lessons/${card.lesson_id}${card.video_time ? `?t=${Math.floor(card.video_time)}` : ""}`}
                                    className={styles.source}
                                >
                                    <Icon name={card.youtube_id ? "video" : "book"} size={13} /> {card.lesson_title}
                                </Link>
                            )}
                        </div>
                    )}

                    {mode === "cards" && !revealed && (
                        <button className={`btn primary ${styles.reveal}`} onClick={() => setRevealed(true)}>
                            {t("review.show_answer")} <kbd>Space</kbd>
                        </button>
                    )}

                    {revealed && (
                        <div className={styles.ratings}>
                            {RATINGS.map(({ rating, key }) => (
                                <button
                                    key={rating}
                                    className={`btn ${styles.rating} ${correct === true && rating === 3 ? "primary" : ""} ${correct === false && rating === 1 ? "primary" : ""}`}
                                    data-rating={rating}
                                    disabled={busy}
                                    onClick={() => rate(rating)}
                                >
                                    <span>{t(key)}</span>
                                    <small>
                                        {formatInterval(card.intervals[String(rating) as "1"])} · <kbd>{rating}</kbd>
                                    </small>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
