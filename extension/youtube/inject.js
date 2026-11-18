// Inyecta worker.js en la página de YouTube. Tiene que correr en el contexto de la página (no en el
// mundo aislado de la extensión) para hacer las peticiones a YouTube como lo haría la propia web.
(() => {
    "use strict";
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("youtube/worker.js");
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
})();
