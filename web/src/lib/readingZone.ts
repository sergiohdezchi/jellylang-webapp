/**
 * Desplaza la página para que `element` quede en la zona de lectura visible:
 * debajo de los elementos fijos superiores (cabecera, video, barra de audio) y por encima
 * de los inferiores (panel de palabra en móvil). Solo cuentan los obstáculos que se
 * superponen horizontalmente con el elemento, así que en escritorio el video lateral no afecta.
 *
 * Marca los obstáculos con `data-reading-obstruction="top" | "bottom"`.
 */
export function scrollIntoReadingZone(element: HTMLElement, { force = false, behavior = "smooth" as ScrollBehavior } = {}) {
    const rect = element.getBoundingClientRect();
    let zoneTop = 0;
    let zoneBottom = window.innerHeight;

    document.querySelectorAll<HTMLElement>("[data-reading-obstruction]").forEach((node) => {
        const box = node.getBoundingClientRect();
        if (box.height === 0 || box.right <= rect.left || box.left >= rect.right) return;
        if (node.dataset.readingObstruction === "top") zoneTop = Math.max(zoneTop, box.bottom);
        else zoneBottom = Math.min(zoneBottom, box.top);
    });

    const height = Math.max(zoneBottom - zoneTop, 80);
    // Banda cómoda: del borde superior de la zona hasta el 65 % de su altura
    const comfortableBottom = zoneTop + height * 0.65;
    if (!force && rect.top >= zoneTop + 8 && rect.bottom <= comfortableBottom) return;

    const target = zoneTop + Math.min(height * 0.2, 120);
    window.scrollBy({ top: rect.top - target, behavior });
}

/** Detecta si el usuario se ha desplazado a mano hace poco (para no pelear con su scroll). */
export function createManualScrollGuard(pauseMs = 3500) {
    let lastManual = 0;
    const mark = () => {
        lastManual = performance.now();
    };
    const keys = (event: KeyboardEvent) => {
        if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) mark();
    };
    window.addEventListener("wheel", mark, { passive: true });
    window.addEventListener("touchmove", mark, { passive: true });
    window.addEventListener("keydown", keys);

    return {
        recentlyScrolled: () => performance.now() - lastManual < pauseMs,
        dispose: () => {
            window.removeEventListener("wheel", mark);
            window.removeEventListener("touchmove", mark);
            window.removeEventListener("keydown", keys);
        },
    };
}
