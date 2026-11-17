import { useEffect, useRef } from "react";
import { api } from "../api/client";

const FLUSH_SECONDS = 30;

/** Acumula segundos de escucha mientras `playing` y los envía en bloques de 30 s. */
export function useListeningTracker(playing: boolean, languageId: number) {
    const seconds = useRef(0);

    useEffect(() => {
        const flush = (min: number) => {
            if (seconds.current < min) return;
            const value = seconds.current;
            seconds.current = 0;
            api("/stats/activity", { method: "POST", body: { language_id: languageId, listening_seconds: value } }).catch(() => {});
        };
        const timer = window.setInterval(() => {
            if (!playing) return;
            seconds.current += 1;
            if (seconds.current >= FLUSH_SECONDS) flush(FLUSH_SECONDS);
        }, 1000);
        return () => {
            window.clearInterval(timer);
            flush(5);
        };
    }, [playing, languageId]);
}
