import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { LessonDetail, PhraseEntry } from "../api/types";
import { useAuth, useLanguage } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { useConfig } from "../hooks/useConfig";
import { useVocabulary } from "../hooks/useVocabulary";
import { scrollIntoReadingZone } from "../lib/readingZone";
import { tokenize, wordTerms } from "../lib/tokenize";
import Icon from "../components/Icon";
import TextReader from "../components/Reader/TextReader";
import VideoReader from "../components/Reader/VideoReader";
import WordPanel from "../components/WordPanel/WordPanel";
import type { PreparedSegment, WordSelection } from "../components/Reader/types";
import type { Playback } from "../components/Reader/playback";
import styles from "./LessonPage.module.scss";

export default function LessonPage() {
    const { id } = useParams();
    const { t } = useI18n();

    const { data: lesson, error, isLoading } = useQuery({
        queryKey: ["lesson", id],
        queryFn: () => api<LessonDetail>(`/lessons/${id}`),
        refetchInterval: (query) => (query.state.data?.status === "processing" ? 2000 : false),
        staleTime: 0,
    });

    if (isLoading) {
        return (
            <div className="center-state">
                <div className="spinner" />
            </div>
        );
    }
    if (error || !lesson) return <div className="container alert error">{error?.message ?? t("common.error")}</div>;
    if (lesson.status !== "ready") return <PendingLesson lesson={lesson} />;
    return <LessonReader key={lesson.id} lesson={lesson} />;
}

function LessonReader({ lesson }: { lesson: LessonDetail }) {
    const { t } = useI18n();
    const { user } = useAuth();
    const language = useLanguage();
    const [params] = useSearchParams();
    const vocabulary = useVocabulary(lesson);
    const [selection, setSelection] = useState<WordSelection | null>(null);
    const [wordOpenCount, setWordOpenCount] = useState(0);
    const readerRef = useRef<HTMLDivElement>(null);
    const playbackRef = useRef<Playback | null>(null);

    const prepared: PreparedSegment[] = useMemo(
        () =>
            lesson.segments.map((segment) => {
                const tokens = tokenize(segment.text);
                const terms = tokens.flatMap((tk) => (tk.kind === "word" ? [tk.term] : []));
                return { segment, tokens, terms };
            }),
        [lesson.segments],
    );

    const open = useCallback((next: WordSelection) => {
        setSelection(next);
        setWordOpenCount((n) => n + 1);
    }, []);

    const handleWordClick = useCallback(
        (term: string, display: string, item: PreparedSegment, phrase?: PhraseEntry) =>
            open({ term, display, isPhrase: false, segment: item.segment, phrase }),
        [open],
    );

    // Selección de varias palabras con el ratón -> frase
    function handleMouseUp() {
        const browserSelection = window.getSelection();
        const text = browserSelection?.toString().trim() ?? "";
        if (!browserSelection || !/\s/.test(text) || text.length > 200) return;

        const node = browserSelection.anchorNode;
        const element = node instanceof Element ? node : node?.parentElement;
        const segmentId = Number(element?.closest("[data-segment-id]")?.getAttribute("data-segment-id"));
        const segment = lesson.segments.find((s) => s.id === segmentId);
        const terms = wordTerms(text);
        if (!segment || terms.length < 2) return;

        open({ term: terms.join(" "), display: text.replace(/\s+/g, " "), isPhrase: true, segment });
    }

    const counts = useMemo(() => {
        const unique = new Set(prepared.flatMap((p) => p.terms));
        let fresh = 0;
        let lingqs = 0;
        unique.forEach((term) => {
            const entry = vocabulary.entries.get(term);
            if (!entry) fresh++;
            else if (entry.status === "learning") lingqs++;
        });
        return { fresh, lingqs };
    }, [prepared, vocabulary.entries]);

    const initialTime = Number(params.get("t")) || undefined;
    const segmentIndex = useMemo(() => new Map(lesson.segments.map((s, i) => [s.id, i])), [lesson.segments]);

    // En móvil el panel ocupa la parte inferior: sube la palabra elegida para que siga visible
    useEffect(() => {
        if (!selection) return;
        const timer = window.setTimeout(() => {
            const target =
                readerRef.current?.querySelector<HTMLElement>('[data-selected="true"]') ??
                readerRef.current?.querySelector<HTMLElement>(`[data-segment-id="${selection.segment.id}"]`);
            if (target) scrollIntoReadingZone(target);
        }, 200);
        return () => window.clearTimeout(timer);
    }, [selection]);

    return (
        <div className={`${styles.page} ${selection ? styles.withPanel : ""}`}>
            <div className={styles.topbar}>
                <Link to="/" className="btn ghost small">
                    <Icon name="arrowLeft" size={16} /> {t("lesson.back")}
                </Link>
                <div className={styles.titleBlock}>
                    <h1 className={styles.title}>{lesson.title}</h1>
                    <div className={styles.meta}>
                        {lesson.author && <span>{lesson.author}</span>}
                        <span className={styles.legendNew}>{t("lesson.new_words", { count: counts.fresh })}</span>
                        <span className={styles.legendLingq}>{t("lesson.lingqs_count", { count: counts.lingqs })}</span>
                        {lesson.source_url && (
                            <a href={lesson.source_url} target="_blank" rel="noreferrer">
                                <Icon name="external" size={13} />
                            </a>
                        )}
                    </div>
                </div>
            </div>

            <p className={styles.hint}>{t("lesson.select_hint")}</p>

            <div ref={readerRef} onMouseUp={handleMouseUp}>
                {lesson.youtube_id ? (
                    <VideoReader
                        lesson={lesson}
                        prepared={prepared}
                        vocabulary={vocabulary}
                        selectedTerm={selection?.isPhrase ? null : (selection?.term ?? null)}
                        onWordClick={handleWordClick}
                        wordOpenCount={wordOpenCount}
                        initialTime={initialTime}
                        playbackRef={playbackRef}
                        panelOpen={Boolean(selection)}
                    />
                ) : (
                    <TextReader
                        lesson={lesson}
                        language={language}
                        prepared={prepared}
                        vocabulary={vocabulary}
                        selectedTerm={selection?.isPhrase ? null : (selection?.term ?? null)}
                        onWordClick={handleWordClick}
                        wordOpenCount={wordOpenCount}
                        playbackRef={playbackRef}
                    />
                )}
            </div>

            {selection && user && (
                <WordPanel
                    selection={selection}
                    vocabulary={vocabulary}
                    language={language}
                    nativeLanguage={user.native_language}
                    onClose={() => {
                        setSelection(null);
                        window.getSelection()?.removeAllRanges();
                    }}
                    onOpenPhrase={open}
                    onPlaySentence={() => {
                        const index = segmentIndex.get(selection.segment.id);
                        if (index !== undefined) playbackRef.current?.playSegment(index);
                    }}
                />
            )}
        </div>
    );
}

function PendingLesson({ lesson }: { lesson: LessonDetail }) {
    const { t } = useI18n();
    const { data: config } = useConfig();
    const ytdlpOff = config?.ytdlp_enabled === false;
    const queryClient = useQueryClient();
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function act(action: () => Promise<unknown>) {
        setBusy(true);
        setError(null);
        try {
            await action();
            await queryClient.invalidateQueries({ queryKey: ["lesson", String(lesson.id)] });
            queryClient.invalidateQueries({ queryKey: ["lessons"] });
        } catch (err) {
            setError(err instanceof Error ? err.message : t("common.error"));
        } finally {
            setBusy(false);
        }
    }

    function upload(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;
        const data = new FormData();
        data.append("file", file);
        act(() => api(`/lessons/${lesson.id}/subtitles`, { method: "POST", body: data }));
    }

    return (
        <div className="container">
            <div className={`card ${styles.pending}`}>
                {lesson.thumbnail_url && <img src={lesson.thumbnail_url} alt="" className={styles.thumb} />}
                <h1>{lesson.title}</h1>

                {lesson.status === "processing" ? (
                    <>
                        <div className="spinner" />
                        <h2>{t("lesson.processing_title")}</h2>
                        <p className="muted">{t("lesson.processing_text")}</p>
                    </>
                ) : (
                    <>
                        <h2>{t("lesson.failed_title")}</h2>
                        <div className="alert error">{lesson.error_message}</div>
                        {error && <div className="alert error">{error}</div>}
                        <p className="muted">{t("lesson.upload_hint")}</p>
                        <div className={styles.pendingActions}>
                            <label className="btn primary">
                                <Icon name="upload" /> {t("lesson.upload_subs")}
                                <input type="file" accept=".srt,.vtt" hidden onChange={upload} disabled={busy} />
                            </label>
                            {lesson.youtube_id && !ytdlpOff && (
                                <button className="btn" disabled={busy} onClick={() => act(() => api(`/lessons/${lesson.id}/reimport`, { method: "POST" }))}>
                                    <Icon name="repeat" /> {t("lesson.retry")}
                                </button>
                            )}
                        </div>
                        {lesson.youtube_id && ytdlpOff && <p className="muted">{t("lesson.extension_hint")}</p>}
                    </>
                )}
                <Link to="/">{t("lesson.back")}</Link>
            </div>
        </div>
    );
}
