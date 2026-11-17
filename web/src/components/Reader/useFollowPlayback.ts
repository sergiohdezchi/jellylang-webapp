import { useEffect, useRef, type RefObject } from "react";
import { createManualScrollGuard, scrollIntoReadingZone } from "../../lib/readingZone";
import type { Playback } from "./playback";

/**
 * Mantiene visible lo que se está leyendo: la palabra hablada o, si no hay, la frase activa.
 * Solo desplaza cuando sale de la zona cómoda y se detiene unos segundos si el usuario
 * hace scroll a mano.
 */
export function useFollowPlayback(rootRef: RefObject<HTMLElement | null>, playback: Playback, enabled: boolean) {
    const guard = useRef<ReturnType<typeof createManualScrollGuard> | null>(null);

    useEffect(() => {
        guard.current = createManualScrollGuard();
        return () => guard.current?.dispose();
    }, []);

    useEffect(() => {
        if (!enabled || playback.activeIndex < 0 || guard.current?.recentlyScrolled()) return;
        const root = rootRef.current;
        const target =
            root?.querySelector<HTMLElement>('[data-speaking="true"]') ?? root?.querySelector<HTMLElement>('[data-active="true"]');
        if (target) scrollIntoReadingZone(target);
    }, [rootRef, enabled, playback.activeIndex, playback.activeWord]);
}

/** Pausa la reproducción cuando se abre una palabra, si el usuario lo tiene activado. */
export function usePauseOnWord(playback: Playback, wordOpenCount: number, enabled: boolean) {
    const ref = useRef(playback);
    ref.current = playback;
    useEffect(() => {
        if (wordOpenCount > 0 && enabled && ref.current.playing) ref.current.pause();
    }, [wordOpenCount, enabled]);
}
