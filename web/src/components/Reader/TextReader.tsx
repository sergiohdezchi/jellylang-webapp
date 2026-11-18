import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { Language, LessonDetail } from "../../api/types";
import { useI18n } from "../../i18n/I18nProvider";
import { useListeningTracker } from "../../hooks/useListeningTracker";
import { useSpeechPlayback } from "../../hooks/useSpeechPlayback";
import { useStoredState } from "../../hooks/useStoredState";
import type { Vocabulary } from "../../hooks/useVocabulary";
import { paginate } from "../../lib/segments";
import Icon from "../Icon";
import PlayerControls from "./PlayerControls";
import SegmentText from "./SegmentText";
import type { Playback } from "./playback";
import type { PreparedSegment } from "./types";
import { useFollowPlayback, usePauseOnWord } from "./useFollowPlayback";
import { usePhraseMarks } from "./usePhraseMarks";
import styles from "./TextReader.module.scss";

interface Props {
    lesson: LessonDetail;
    language: Language;
    prepared: PreparedSegment[];
    vocabulary: Vocabulary;
    selectedTerm: string | null;
    onWordClick: (term: string, display: string, prepared: PreparedSegment) => void;
    wordOpenCount: number;
    playbackRef: MutableRefObject<Playback | null>;
}

export default function TextReader({ lesson, language, prepared, vocabulary, selectedTerm, onWordClick, wordOpenCount, playbackRef }: Props) {
    const { t } = useI18n();
    const queryClient = useQueryClient();
    const articleRef = useRef<HTMLElement>(null);
    const { playback, voices, voice, setVoiceName, supported } = useSpeechPlayback(prepared, language.code);
    const [autoScroll, setAutoScroll] = useStoredState("jellylang.autoScroll", true);
    const [pauseOnWord, setPauseOnWord] = useStoredState("jellylang.pauseOnWord", true);

    playbackRef.current = playback;
    useListeningTracker(playback.playing, lesson.language_id);
    useFollowPlayback(articleRef, playback, autoScroll);
    usePauseOnWord(playback, wordOpenCount, pauseOnWord);

    const indexById = useMemo(() => new Map(prepared.map((p, i) => [p.segment.id, i])), [prepared]);

    const pages = useMemo(() => {
        const paragraphs: PreparedSegment[][] = [];
        prepared.forEach((item) => {
            const last = paragraphs[paragraphs.length - 1];
            if (last && last[0].segment.paragraph === item.segment.paragraph) last.push(item);
            else paragraphs.push([item]);
        });
        return paginate(paragraphs, (p) => p.reduce((sum, item) => sum + item.terms.length, 0));
    }, [prepared]);

    const pageOfIndex = useMemo(() => {
        const map = new Map<number, number>();
        pages.forEach((page, pageIndex) => page.flat().forEach((item) => map.set(indexById.get(item.segment.id)!, pageIndex)));
        return map;
    }, [pages, indexById]);

    const firstIndexOf = (pageIndex: number) => indexById.get(pages[pageIndex][0][0].segment.id) ?? 0;

    const [page, setPage] = useState(() => Math.min(lesson.progress_page, Math.max(pages.length - 1, 0)));
    const [completed, setCompleted] = useState(false);
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const phraseMarks = usePhraseMarks(prepared, vocabulary.phrases);

    const current = pages[page] ?? [];
    const isLast = page >= pages.length - 1;

    // La voz empieza en la página que se está viendo
    useEffect(() => {
        playback.setPosition(firstIndexOf(page));
    }, []);

    // Si la voz pasa a otra página, el lector la sigue
    useEffect(() => {
        const target = pageOfIndex.get(playback.activeIndex);
        if (target === undefined || target === page) return;
        if (target === page + 1 && playback.playing) advance(page + 1, true);
        else setPage(target);
    }, [playback.activeIndex]);

    /** Avanza de página: las palabras azules de la página actual pasan a conocidas (como en LingQ). */
    async function advance(target: number, fromPlayback = false) {
        if (busyRef.current) return;
        busyRef.current = true;
        setBusy(true);

        const pageTerms = current.flat().flatMap((item) => item.terms);
        const completing = target >= pages.length;

        if (completing) {
            playback.pause();
        } else {
            setPage(target);
            if (!fromPlayback) {
                playback.setPosition(firstIndexOf(target));
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        }

        try {
            await vocabulary.markKnown(pageTerms);
            await api("/stats/activity", { method: "POST", body: { language_id: lesson.language_id, words_read: pageTerms.length } });
            await api(`/lessons/${lesson.id}`, {
                method: "PATCH",
                body: completing ? { completed: true } : { progress_page: target },
            });
            queryClient.invalidateQueries({ queryKey: ["lessons"] });
            queryClient.invalidateQueries({ queryKey: ["stats"] });
            if (completing) setCompleted(true);
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    }

    function goBack() {
        const target = Math.max(0, page - 1);
        setPage(target);
        playback.setPosition(firstIndexOf(target));
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (completed) {
        return (
            <div className={`card ${styles.done}`}>
                <Icon name="check" size={40} />
                <h2>{t("lesson.completed")}</h2>
                <button
                    className="btn"
                    onClick={() => {
                        setCompleted(false);
                        setPage(0);
                        playback.setPosition(0);
                    }}
                >
                    {t("lesson.page", { page: 1, total: pages.length })}
                </button>
            </div>
        );
    }

    const voiceSettings = (
        <label className="field" style={{ margin: 0 }}>
            <span>{t("player.voice")}</span>
            {voices.length > 0 ? (
                <select className="select" value={voice?.name ?? ""} onChange={(e) => setVoiceName(e.target.value)}>
                    {voices.map((v) => (
                        <option key={v.name} value={v.name}>
                            {v.name} ({v.lang})
                        </option>
                    ))}
                </select>
            ) : (
                <small className="muted">{supported ? t("player.no_voices", { language: language.name }) : t("player.no_speech")}</small>
            )}
        </label>
    );

    return (
        <div>
            <div className={styles.playerBar} data-reading-obstruction="top">
                <PlayerControls
                    playback={playback}
                    autoScroll={autoScroll}
                    onAutoScrollChange={setAutoScroll}
                    pauseOnWord={pauseOnWord}
                    onPauseOnWordChange={setPauseOnWord}
                    settings={voiceSettings}
                    label={t("player.listen_text")}
                />
                {!playback.available && (
                    <small className={styles.unavailable}>
                        {supported ? t("player.no_voices", { language: language.name }) : t("player.no_speech")}
                    </small>
                )}
            </div>

            <article className={styles.text} ref={articleRef}>
                {current.map((paragraph) => (
                    <p key={paragraph[0].segment.id}>
                        {paragraph.map((item, i) => {
                            const index = indexById.get(item.segment.id)!;
                            const active = index === playback.activeIndex;
                            return (
                                <span
                                    key={item.segment.id}
                                    data-segment-id={item.segment.id}
                                    data-active={active || undefined}
                                    className={active ? styles.activeSentence : undefined}
                                >
                                    {i > 0 && " "}
                                    <SegmentText
                                        prepared={item}
                                        entries={vocabulary.entries}
                                        phraseMarks={phraseMarks.get(item.segment.id)}
                                        selectedTerm={selectedTerm}
                                        activeWord={active ? playback.activeWord : -1}
                                        onWordClick={onWordClick}
                                    />
                                </span>
                            );
                        })}
                    </p>
                ))}
            </article>

            <nav className={styles.pager}>
                <button className="btn" onClick={goBack} disabled={page === 0 || busy}>
                    <Icon name="arrowLeft" /> <span className={styles.pagerLabel}>{t("common.prev")}</span>
                </button>
                <span className="muted">{t("lesson.page", { page: page + 1, total: pages.length })}</span>
                <button
                    className="btn primary"
                    onClick={() => advance(page + 1)}
                    disabled={busy}
                    title={isLast ? t("lesson.complete_hint") : t("lesson.next_hint")}
                >
                    {isLast ? t("lesson.complete") : t("common.next")}
                    {isLast ? <Icon name="check" /> : <Icon name="next" />}
                </button>
            </nav>
            <p className={styles.hint}>{isLast ? t("lesson.complete_hint") : t("lesson.next_hint")}</p>
        </div>
    );
}
