import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Playback } from "../components/Reader/playback";
import type { PreparedSegment } from "../components/Reader/types";
import { findActiveSegment, findLastStarted } from "../lib/segments";
import { exactWordTimes, wordAtTime } from "../lib/wordTiming";
import { useStoredState } from "./useStoredState";
import { useYouTubePlayer } from "./useYouTubePlayer";

const TICK_MS = 80;

/**
 * Sincroniza el reproductor de YouTube con la transcripción: frase activa, palabra hablada
 * y bucle de frase. El tiempo que informa el iframe se actualiza a saltos, así que entre
 * muestras se extrapola con el reloj local y la velocidad de reproducción.
 * La palabra solo se marca con tiempos reales (ver exactWordTimes), nunca estimados.
 */
export function useYouTubePlayback(videoId: string, prepared: PreparedSegment[]) {
    const { containerRef, player, playing } = useYouTubePlayer(videoId);
    const [rate, setRate] = useStoredState("linguaq.speed", 1);
    const [loopIndex, setLoopIndex] = useState<number | null>(null);
    const [position, setPosition] = useState({ index: -1, word: -1 });
    const sample = useRef({ reported: -1, at: 0 });

    const segments = useMemo(() => prepared.map((p) => p.segment), [prepared]);
    // Solo hay tiempo por palabra en los subtítulos automáticos de YouTube; sin él, se marca la frase.
    const wordTimes = useMemo(() => prepared.map(({ segment, terms }) => exactWordTimes(segment, terms.length)), [prepared]);

    useEffect(() => {
        if (player) player.setPlaybackRate(rate);
    }, [player, rate]);

    useEffect(() => {
        if (!player) return;

        const timer = window.setInterval(() => {
            const reported = player.getCurrentTime?.() ?? 0;
            const now = performance.now();
            let time = reported;

            if (player.getPlayerState?.() === YT.PlayerState.PLAYING) {
                if (reported !== sample.current.reported) sample.current = { reported, at: now };
                else time = reported + Math.min(1, (now - sample.current.at) / 1000) * (player.getPlaybackRate?.() ?? 1);
            } else {
                sample.current = { reported, at: now };
            }

            if (loopIndex !== null) {
                const segment = segments[loopIndex];
                if (segment && (time >= (segment.end ?? 0) || time < (segment.start ?? 0) - 1)) {
                    player.seekTo(segment.start ?? 0, true);
                    return;
                }
            }

            let index = findActiveSegment(segments, time);
            if (index === -1) index = findLastStarted(segments, time);
            const segment = segments[index];
            const times = wordTimes[index];
            const word = times && segment && time <= (segment.end ?? Infinity) + 0.2 ? wordAtTime(times, time) : -1;

            setPosition((current) => (current.index === index && current.word === word ? current : { index, word }));
        }, TICK_MS);

        return () => window.clearInterval(timer);
    }, [player, segments, wordTimes, loopIndex]);

    const seek = useCallback(
        (index: number, play: boolean) => {
            const segment = segments[index];
            if (!player || !segment) return;
            player.seekTo(segment.start ?? 0, true);
            if (play) player.playVideo();
        },
        [player, segments],
    );

    const playback: Playback = {
        kind: "video",
        available: Boolean(player),
        playing,
        activeIndex: position.index,
        activeWord: playing ? position.word : -1,
        rate,
        setRate,
        loop: loopIndex !== null,
        setLoop: (on) => setLoopIndex(on ? Math.max(position.index, 0) : null),
        play: () => player?.playVideo(),
        pause: () => player?.pauseVideo(),
        toggle: () => (playing ? player?.pauseVideo() : player?.playVideo()),
        playSegment: (index) => {
            if (loopIndex !== null) setLoopIndex(index);
            seek(index, true);
        },
        setPosition: (index) => seek(index, false),
    };

    return { playback, containerRef, player };
}
