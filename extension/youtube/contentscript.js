// Content script de YouTube (mundo aislado). Responde al popup con los datos que worker.js deja en el DOM
// y descarga los subtítulos elegidos.
//   GetVideoInfo                 → datos del video
//   GetVideoTracks { language }  → pistas de ese idioma (manuales primero) y los idiomas disponibles
//   GetVideoSubs   { tid }       → contenido de la pista en formato json3
(() => {
    "use strict";
    const TARGET = "jellylang-youtube";
    const CONTAINER_ID = "JELLYLANG_YT";
    // Códigos antiguos que YouTube sigue usando
    const ALIASES = { iw: "he", in: "id", ji: "yi", fil: "tl" };

    const baseLanguage = (code) => {
        const base = String(code).toLowerCase().split(/[-_]/)[0];
        return ALIASES[base] ?? base;
    };
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    class Fail extends Error {
        constructor(code, message) {
            super(message ?? code);
            this.code = code;
        }
    }

    function currentNode() {
        const id = document.getElementById(CONTAINER_ID)?.dataset.current;
        return id ? document.getElementById(`jellylang-video-${id}`) : null;
    }

    /** Espera a que worker.js termine de cargar el video actual (reintenta una vez si falló). */
    async function videoNode() {
        let retried = false;
        for (let i = 0; i < 120; i++) {
            const node = currentNode();
            if (node?.dataset.status === "ready") return node;
            if (node?.dataset.status === "error") {
                if (retried) throw new Fail("video_unavailable", node.dataset.error);
                retried = true;
                window.dispatchEvent(new CustomEvent("jellylang:refresh"));
            }
            await sleep(100);
        }
        throw new Fail("no_video");
    }

    async function tracksOf() {
        const node = await videoNode();
        return JSON.parse(node.dataset.tracks ?? "[]").map((track, tid) => ({ ...track, tid }));
    }

    const handlers = {
        async GetVideoInfo() {
            const node = await videoNode();
            return JSON.parse(node.dataset.info);
        },

        async GetVideoTracks({ language }) {
            const all = await tracksOf();
            const tracks = all
                .filter((track) => baseLanguage(track.languageCode) === language)
                .sort((a, b) => (a.kind === "asr") - (b.kind === "asr"));
            const available = [...new Set(all.map((track) => track.name))];
            return { tracks: tracks.map(({ url, ...track }) => track), available };
        },

        async GetVideoSubs({ tid }) {
            const track = (await tracksOf()).find((item) => item.tid === tid);
            if (!track) throw new Fail("track_unavailable");

            const url = new URL(track.url);
            url.searchParams.set("fmt", "json3");
            const response = await fetch(url.href);
            if (!response.ok) throw new Fail("subtitles_failed", `HTTP ${response.status}`);

            const content = await response.text();
            let events;
            try {
                events = JSON.parse(content).events;
            } catch {
                events = null;
            }
            if (!Array.isArray(events) || events.length === 0) throw new Fail("empty_subtitles");

            return { format: "json3", kind: track.kind, language: track.languageCode, content };
        },
    };

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.target !== TARGET || !handlers[message.type]) return false;
        handlers[message.type](message.payload ?? {}).then(
            (result) => sendResponse({ ok: true, result }),
            (error) => sendResponse({ ok: false, error: { code: error?.code ?? "unexpected", message: String(error?.message ?? error) } }),
        );
        return true; // respuesta asíncrona
    });
})();
