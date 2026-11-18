// Corre en el contexto de la página de YouTube.
//
// Para cada video que se abre, pide su información a la API del reproductor de YouTube identificándose
// como la app de Android: así YouTube devuelve URLs de subtítulos que se pueden descargar sin el token
// que exige la web. Es una API interna, no aprobada por YouTube (la misma técnica que usa yt-dlp).
//
// El resultado se deja en un <div> oculto (#JELLYLANG_YT): es el canal hacia contentscript.js, que vive en el
// mundo aislado de la extensión y no ve las variables de la página, pero sí el DOM.
(() => {
    "use strict";
    if (window.__jellylangYouTube) return;
    window.__jellylangYouTube = true;

    const CONTAINER_ID = "JELLYLANG_YT";
    const PLAYER_URL = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
    // Si YouTube deja de aceptar esta versión, se actualiza a una reciente de la app de YouTube para Android.
    const ANDROID_CLIENT = { clientName: "ANDROID", clientVersion: "20.10.38" };

    /** ID del video de la URL actual: /watch?v=ID, /shorts/ID o /live/ID */
    function currentVideoId() {
        const fromQuery = new URLSearchParams(location.search).get("v");
        if (fromQuery) return fromQuery;
        const parts = location.pathname.split("/").filter(Boolean);
        return parts.length === 2 && (parts[0] === "shorts" || parts[0] === "live") ? parts[1] : null;
    }

    function container() {
        let box = document.getElementById(CONTAINER_ID);
        if (!box) {
            box = document.createElement("div");
            box.id = CONTAINER_ID;
            box.hidden = true;
            (document.body || document.documentElement).appendChild(box);
        }
        return box;
    }

    const trackName = (track) =>
        (track.name?.simpleText ?? (track.name?.runs ?? []).map((run) => run.text ?? "").join("")).trim();

    // La URL de la pista sin formato: el content script pide el que necesita (json3)
    function cleanTrackUrl(raw) {
        const url = new URL(raw, location.origin);
        url.searchParams.delete("fmt");
        return url.href;
    }

    async function fetchPlayer(videoId) {
        const response = await fetch(PLAYER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoId, context: { client: ANDROID_CLIENT } }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    }

    async function load({ force = false } = {}) {
        const videoId = currentVideoId();
        const box = container();
        box.dataset.current = videoId ?? "";
        if (!videoId) return;

        const nodeId = `jellylang-video-${videoId}`;
        let node = document.getElementById(nodeId);
        if (node && !force) return; // ya cargado (o cargándose)
        node?.remove();

        node = document.createElement("div");
        node.id = nodeId;
        node.dataset.status = "loading";
        box.appendChild(node);

        try {
            const data = await fetchPlayer(videoId);
            const details = data?.videoDetails;
            if (!details?.videoId) throw new Error(data?.playabilityStatus?.reason ?? "YouTube no devolvió datos del video");

            const thumbnails = details.thumbnail?.thumbnails ?? [];
            node.dataset.info = JSON.stringify({
                videoId: details.videoId,
                title: details.title ?? "",
                author: details.author ?? "",
                duration: Number(details.lengthSeconds) || null,
                image: thumbnails.at(-1)?.url ?? null,
                isLive: Boolean(details.isLive),
            });

            const tracks = data.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
            node.dataset.tracks = JSON.stringify(
                tracks.map((track) => ({
                    languageCode: track.languageCode,
                    name: trackName(track) || track.languageCode,
                    kind: track.kind === "asr" ? "asr" : "manual",
                    url: cleanTrackUrl(track.baseUrl),
                })),
            );
            node.dataset.status = "ready";
        } catch (error) {
            node.dataset.error = String(error?.message ?? error);
            node.dataset.status = "error";
        }
    }

    // YouTube es una SPA: hay que volver a cargar cuando cambia la URL sin recargar la página
    let lastHref = location.href;
    const onNavigate = () => {
        if (location.href === lastHref) return;
        lastHref = location.href;
        load();
    };
    window.addEventListener("yt-navigate-finish", onNavigate);
    window.addEventListener("popstate", onNavigate);

    // El content script pide reintentar si la carga falló
    window.addEventListener("jellylang:refresh", () => load({ force: true }));

    const start = () => {
        load();
        new MutationObserver(onNavigate).observe(document.body, { childList: true, subtree: true });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
})();
