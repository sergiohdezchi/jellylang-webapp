/** Contrato común para el video de YouTube y la lectura con voz del navegador. */
export interface Playback {
    kind: "video" | "speech";
    /** Se puede reproducir (reproductor listo o hay voz para el idioma) */
    available: boolean;
    playing: boolean;
    /** Índice del segmento que suena; -1 si ninguno */
    activeIndex: number;
    /** Índice de palabra (Token.index) dentro del segmento activo; -1 si ninguna */
    activeWord: number;
    rate: number;
    setRate: (rate: number) => void;
    loop: boolean;
    setLoop: (loop: boolean) => void;
    play: () => void;
    pause: () => void;
    toggle: () => void;
    playSegment: (index: number) => void;
    /** Coloca la posición sin reproducir */
    setPosition: (index: number) => void;
}

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
