import { useEffect, useRef, useState } from "react";
import { findActiveSegment, findLastStarted, type TimedSegment } from "../lib/segments";

/**
 * Consulta el tiempo del reproductor cada ~200 ms y devuelve el índice del segmento activo.
 * En los silencios entre frases mantiene resaltado el último segmento que empezó.
 */
export function useActiveSegment(player: YT.Player | null, segments: TimedSegment[], onTick?: (time: number) => void) {
    const [activeIndex, setActiveIndex] = useState(-1);
    const lastIndex = useRef(-1);
    const tickRef = useRef(onTick);
    tickRef.current = onTick;

    useEffect(() => {
        if (!player) return;

        const timer = window.setInterval(() => {
            const time = player.getCurrentTime?.() ?? 0;
            let index = findActiveSegment(segments, time);
            if (index === -1) index = findLastStarted(segments, time);

            if (index !== lastIndex.current) {
                lastIndex.current = index;
                setActiveIndex(index);
            }
            tickRef.current?.(time);
        }, 200);

        return () => window.clearInterval(timer);
    }, [player, segments]);

    return activeIndex;
}
