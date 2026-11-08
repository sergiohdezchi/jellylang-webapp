import { useEffect, useRef, useState } from "react";

type YouTubeWindow = Window & { YT?: typeof YT; onYouTubeIframeAPIReady?: () => void };

let apiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
    const w = window as YouTubeWindow;
    if (w.YT?.Player) return Promise.resolve();

    apiPromise ??= new Promise<void>((resolve) => {
        const previous = w.onYouTubeIframeAPIReady;
        w.onYouTubeIframeAPIReady = () => {
            previous?.();
            resolve();
        };
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        document.head.appendChild(script);
    });

    return apiPromise;
}

/** Monta el reproductor oficial de YouTube (IFrame Player API) dentro de `containerRef`. */
export function useYouTubePlayer(videoId: string) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [player, setPlayer] = useState<YT.Player | null>(null);
    const [playing, setPlaying] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let instance: YT.Player | null = null;
        const container = containerRef.current;

        loadYouTubeApi().then(() => {
            if (cancelled || !container) return;
            const mount = document.createElement("div");
            container.appendChild(mount);

            instance = new YT.Player(mount, {
                videoId,
                width: "100%",
                height: "100%",
                playerVars: { rel: 0, playsinline: 1, cc_load_policy: 0, iv_load_policy: 3 },
                events: {
                    onReady: () => {
                        if (!cancelled) setPlayer(instance);
                    },
                    onStateChange: (event) => setPlaying(event.data === YT.PlayerState.PLAYING),
                },
            });
        });

        return () => {
            cancelled = true;
            instance?.destroy();
            if (container) container.innerHTML = "";
            setPlayer(null);
            setPlaying(false);
        };
    }, [videoId]);

    return { containerRef, player, playing };
}
