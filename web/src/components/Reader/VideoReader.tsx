import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { LessonDetail } from "../../api/types";
import { useI18n } from "../../i18n/I18nProvider";
import { useListeningTracker } from "../../hooks/useListeningTracker";
import { useStoredState } from "../../hooks/useStoredState";
import { useYouTubePlayback } from "../../hooks/useYouTubePlayback";
import type { Vocabulary } from "../../hooks/useVocabulary";
import { formatClock } from "../../lib/format";
import Icon from "../Icon";
import PlayerControls from "./PlayerControls";
import SegmentText from "./SegmentText";
import type { Playback } from "./playback";
import type { PreparedSegment } from "./types";
import { useFollowPlayback, usePauseOnWord } from "./useFollowPlayback";
import { usePhraseMarks } from "./usePhraseMarks";
import styles from "./VideoReader.module.scss";

interface Props {
    lesson: LessonDetail;
    prepared: PreparedSegment[];
    vocabulary: Vocabulary;
    selectedTerm: string | null;
    onWordClick: (term: string, display: string, prepared: PreparedSegment) => void;
    /** Se incrementa cada vez que se abre una palabra (para la pausa automática) */
    wordOpenCount: number;
    initialTime?: number;
    playbackRef: MutableRefObject<Playback | null>;
    /** Hay una palabra abierta en el panel */
    panelOpen: boolean;
}

export default function VideoReader({ lesson, prepared, vocabulary, selectedTerm, onWordClick, wordOpenCount, initialTime, playbackRef, panelOpen }: Props) {
    const { t } = useI18n();
    const queryClient = useQueryClient();
    const { playback, containerRef, player } = useYouTubePlayback(lesson.youtube_id!, prepared);
    const transcriptRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useStoredState("linguaq.autoScroll", true);
    const [pauseOnWord, setPauseOnWord] = useStoredState("linguaq.pauseOnWord", true);
    const [completed, setCompleted] = useState(Boolean(lesson.completed_at));
    const phraseMarks = usePhraseMarks(prepared, vocabulary.phrases);

    playbackRef.current = playback;
    useListeningTracker(playback.playing, lesson.language_id);
    useFollowPlayback(transcriptRef, playback, autoScroll);
    usePauseOnWord(playback, wordOpenCount, pauseOnWord);

    // Empezar en un momento concreto (?t=segundos), p. ej. desde el vocabulario
    useEffect(() => {
        if (player && initialTime) player.seekTo(initialTime, true);
    }, [player, initialTime]);

    async function complete() {
        const terms = prepared.flatMap((p) => p.terms);
        await vocabulary.markKnown(terms);
        await api("/stats/activity", { method: "POST", body: { language_id: lesson.language_id, words_read: terms.length } });
        await api(`/lessons/${lesson.id}`, { method: "PATCH", body: { completed: true } });
        queryClient.invalidateQueries({ queryKey: ["lessons"] });
        queryClient.invalidateQueries({ queryKey: ["stats"] });
        setCompleted(true);
    }

    return (
        <div className={styles.layout}>
            {/* Con el panel abierto y el video en pausa, en móvil el video deja de estar fijo para ganar espacio */}
            <div className={`${styles.videoColumn} ${panelOpen && !playback.playing ? styles.released : ""}`} data-reading-obstruction="top">
                <div className={styles.video} ref={containerRef} />
                <PlayerControls
                    playback={playback}
                    autoScroll={autoScroll}
                    onAutoScrollChange={setAutoScroll}
                    pauseOnWord={pauseOnWord}
                    onPauseOnWordChange={setPauseOnWord}
                />
            </div>

            <div className={styles.transcript} ref={transcriptRef}>
                {lesson.subtitle_source === "auto" && <p className={styles.notice}>{t("lesson.auto_subs")}</p>}

                {prepared.map((item, index) => {
                    const active = index === playback.activeIndex;
                    return (
                        <div
                            key={item.segment.id}
                            data-index={index}
                            data-segment-id={item.segment.id}
                            data-active={active || undefined}
                            className={`${styles.segment} ${active ? styles.active : ""} ${active && playback.loop ? styles.looping : ""}`}
                        >
                            <button className={styles.time} onClick={() => playback.playSegment(index)} title={t("player.play_from")}>
                                <Icon name="play" size={10} /> {formatClock(item.segment.start)}
                            </button>
                            <p className={styles.text}>
                                <SegmentText
                                    prepared={item}
                                    entries={vocabulary.entries}
                                    phraseMarks={phraseMarks.get(item.segment.id)}
                                    selectedTerm={selectedTerm}
                                    activeWord={active ? playback.activeWord : -1}
                                    onWordClick={onWordClick}
                                />
                            </p>
                        </div>
                    );
                })}

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
