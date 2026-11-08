import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { LessonDetail } from "../../api/types";
import { useI18n } from "../../i18n/I18nProvider";
import { useActiveSegment } from "../../hooks/useActiveSegment";
import { useStoredState } from "../../hooks/useStoredState";
import { useYouTubePlayer } from "../../hooks/useYouTubePlayer";
import type { Vocabulary } from "../../hooks/useVocabulary";
import { formatClock } from "../../lib/format";
import Icon from "../Icon";
import SegmentText from "./SegmentText";
import type { PreparedSegment } from "./types";
import { usePhraseMarks } from "./usePhraseMarks";
import styles from "./VideoReader.module.scss";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const LISTENING_FLUSH_SECONDS = 30;

interface Props {
    lesson: LessonDetail;
    prepared: PreparedSegment[];
    vocabulary: Vocabulary;
    selectedTerm: string | null;
    onWordClick: (term: string, display: string, prepared: PreparedSegment) => void;
    /** Se incrementa cada vez que se abre una palabra (para la pausa automática) */
    wordOpenCount: number;
    initialTime?: number;
}

export default function VideoReader({ lesson, prepared, vocabulary, selectedTerm, onWordClick, wordOpenCount, initialTime }: Props) {
    const { t } = useI18n();
    const queryClient = useQueryClient();
    const { containerRef, player, playing } = useYouTubePlayer(lesson.youtube_id!);
    const transcriptRef = useRef<HTMLDivElement>(null);
    const segments = useMemo(() => prepared.map((p) => p.segment), [prepared]);
    const segmentsRef = useRef(segments);
    segmentsRef.current = segments;

    const [speed, setSpeed] = useStoredState("linguaq.speed", 1);
    const [autoScroll, setAutoScroll] = useStoredState("linguaq.autoScroll", true);
    const [pauseOnWord, setPauseOnWord] = useStoredState("linguaq.pauseOnWord", true);
    const [loopIndex, setLoopIndex] = useState<number | null>(null);
    const [completed, setCompleted] = useState(Boolean(lesson.completed_at));
    const listened = useRef(0);
    const phraseMarks = usePhraseMarks(prepared, vocabulary.phrases);

    const onTick = useCallback(
        (time: number) => {
            if (loopIndex === null || !player) return;
            const segment = segmentsRef.current[loopIndex];
            if (segment && (time >= (segment.end ?? 0) || time < (segment.start ?? 0) - 1)) {
                player.seekTo(segment.start ?? 0, true);
            }
        },
        [loopIndex, player],
    );

    const activeIndex = useActiveSegment(player, segments, onTick);

    // Velocidad e inicio en un momento concreto (?t=)
    useEffect(() => {
        if (!player) return;
        player.setPlaybackRate(speed);
    }, [player, speed]);

    useEffect(() => {
        if (player && initialTime) player.seekTo(initialTime, true);
    }, [player, initialTime]);

    // Pausa automática al abrir una palabra
    useEffect(() => {
        if (wordOpenCount > 0 && pauseOnWord && player && playing) player.pauseVideo();
    }, [wordOpenCount]);

    // Auto-scroll de la transcripción
    useEffect(() => {
        if (!autoScroll || activeIndex < 0) return;
        const element = transcriptRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
        element?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, [activeIndex, autoScroll]);

    // Tiempo de escucha: se envía en bloques de 30 s
    useEffect(() => {
        const flush = (min: number) => {
            if (listened.current < min) return;
            const seconds = listened.current;
            listened.current = 0;
            api("/stats/activity", { method: "POST", body: { language_id: lesson.language_id, listening_seconds: seconds } }).catch(() => {});
        };
        const timer = window.setInterval(() => {
            if (!playing) return;
            listened.current += 1;
            if (listened.current >= LISTENING_FLUSH_SECONDS) flush(LISTENING_FLUSH_SECONDS);
        }, 1000);
        return () => {
            window.clearInterval(timer);
            flush(5);
        };
    }, [playing, lesson.language_id]);

    function seekTo(index: number, play = true) {
        const segment = segments[index];
        if (!player || !segment) return;
        player.seekTo(segment.start ?? 0, true);
        if (play) player.playVideo();
    }

    function togglePlay() {
        if (!player) return;
        if (playing) player.pauseVideo();
        else player.playVideo();
    }

    async function complete() {
        const terms = prepared.flatMap((p) => p.terms);
        await vocabulary.markKnown(terms);
        await api("/stats/activity", { method: "POST", body: { language_id: lesson.language_id, words_read: terms.length } });
        await api(`/lessons/${lesson.id}`, { method: "PATCH", body: { completed: true } });
        queryClient.invalidateQueries({ queryKey: ["lessons"] });
        queryClient.invalidateQueries({ queryKey: ["stats"] });
        setCompleted(true);
    }

    const current = activeIndex >= 0 ? activeIndex : 0;

    return (
        <div className={styles.layout}>
            <div className={styles.videoColumn}>
                <div className={styles.video} ref={containerRef} />
                <div className={styles.controls}>
                    <button className="btn icon" onClick={() => seekTo(Math.max(0, current - 1))} title={t("player.prev")} aria-label={t("player.prev")}>
                        <Icon name="prev" />
                    </button>
                    <button className="btn icon primary" onClick={togglePlay} title={playing ? t("player.pause") : t("player.play")} aria-label={playing ? t("player.pause") : t("player.play")}>
                        <Icon name={playing ? "pause" : "play"} />
                    </button>
                    <button className="btn icon" onClick={() => seekTo(current + 1)} title={t("player.next")} aria-label={t("player.next")}>
                        <Icon name="next" />
                    </button>
                    <button className="btn icon" onClick={() => seekTo(current)} title={t("player.repeat")} aria-label={t("player.repeat")}>
                        <Icon name="repeat" />
                    </button>
                    <button
                        className={`btn icon ${loopIndex !== null ? "active" : ""}`}
                        onClick={() => setLoopIndex(loopIndex === null ? current : null)}
                        title={t("player.loop")}
                        aria-label={t("player.loop")}
                        aria-pressed={loopIndex !== null}
                    >
                        <Icon name="loop" />
                    </button>
                    <select className={`select ${styles.speed}`} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label={t("player.speed")}>
                        {SPEEDS.map((s) => (
                            <option key={s} value={s}>
                                {s}×
                            </option>
                        ))}
                    </select>
                </div>
                <div className={styles.toggles}>
                    <label>
                        <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} /> {t("player.autoscroll")}
                    </label>
                    <label>
                        <input type="checkbox" checked={pauseOnWord} onChange={(e) => setPauseOnWord(e.target.checked)} /> {t("player.pause_on_word")}
                    </label>
                </div>
                {lesson.subtitle_source === "auto" && <div className="alert warning">{t("lesson.auto_subs")}</div>}
            </div>

            <div className={styles.transcript} ref={transcriptRef}>
                {prepared.map((item, index) => (
                    <div
                        key={item.segment.id}
                        data-index={index}
                        data-segment-id={item.segment.id}
                        className={`${styles.segment} ${index === activeIndex ? styles.active : ""} ${index === loopIndex ? styles.looping : ""}`}
                    >
                        <button className={styles.time} onClick={() => seekTo(index)} title={t("player.play_from")}>
                            <Icon name="play" size={10} /> {formatClock(item.segment.start)}
                        </button>
                        <p className={styles.text}>
                            <SegmentText
                                prepared={item}
                                entries={vocabulary.entries}
                                phraseMarks={phraseMarks.get(item.segment.id)}
                                selectedTerm={selectedTerm}
                                onWordClick={onWordClick}
                            />
                        </p>
                    </div>
                ))}

                <div className={styles.complete}>
                    {completed ? (
                        <span className="badge accent">
                            <Icon name="check" size={14} /> {t("lesson.completed")}
                        </span>
                    ) : (
                        <>
                            <button className="btn primary" onClick={complete}>
                                <Icon name="check" /> {t("lesson.complete")}
                            </button>
                            <small className="muted">{t("lesson.complete_hint")}</small>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
