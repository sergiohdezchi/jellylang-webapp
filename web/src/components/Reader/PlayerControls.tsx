import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import Icon from "../Icon";
import { SPEEDS, type Playback } from "./playback";
import styles from "./PlayerControls.module.scss";

interface Props {
    playback: Playback;
    autoScroll: boolean;
    onAutoScrollChange: (value: boolean) => void;
    pauseOnWord: boolean;
    onPauseOnWordChange: (value: boolean) => void;
    /** Contenido extra del menú de ajustes (p. ej. selector de voz) */
    settings?: ReactNode;
    /** Etiqueta junto al botón de reproducir (barra de lectura con voz) */
    label?: string;
}

export default function PlayerControls({ playback, autoScroll, onAutoScrollChange, pauseOnWord, onPauseOnWordChange, settings, label }: Props) {
    const { t } = useI18n();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const current = Math.max(playback.activeIndex, 0);
    const disabled = !playback.available;

    useEffect(() => {
        if (!menuOpen) return;
        const close = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [menuOpen]);

    return (
        <div className={styles.bar}>
            <button className="btn icon" onClick={() => playback.playSegment(Math.max(0, current - 1))} disabled={disabled} title={t("player.prev")} aria-label={t("player.prev")}>
                <Icon name="prev" />
            </button>
            <button
                className={`btn primary ${label ? "" : "icon"}`}
                onClick={playback.toggle}
                disabled={disabled}
                title={playback.playing ? t("player.pause") : t("player.play")}
                aria-label={playback.playing ? t("player.pause") : t("player.play")}
            >
                <Icon name={playback.playing ? "pause" : "play"} />
                {label && <span className={styles.label}>{label}</span>}
            </button>
            <button className="btn icon" onClick={() => playback.playSegment(current + 1)} disabled={disabled} title={t("player.next")} aria-label={t("player.next")}>
                <Icon name="next" />
            </button>
            <button className="btn icon" onClick={() => playback.playSegment(current)} disabled={disabled} title={t("player.repeat")} aria-label={t("player.repeat")}>
                <Icon name="repeat" />
            </button>
            <button
                className={`btn icon ${playback.loop ? "active" : ""}`}
                onClick={() => playback.setLoop(!playback.loop)}
                disabled={disabled}
                title={t("player.loop")}
                aria-label={t("player.loop")}
                aria-pressed={playback.loop}
            >
                <Icon name="loop" />
            </button>

            <select
                className={`select ${styles.speed}`}
                value={playback.rate}
                onChange={(e) => playback.setRate(Number(e.target.value))}
                aria-label={t("player.speed")}
                title={t("player.speed")}
            >
                {SPEEDS.map((s) => (
                    <option key={s} value={s}>
                        {s}×
                    </option>
                ))}
            </select>

            <div className={styles.menuWrap} ref={menuRef}>
                <button
                    className={`btn icon ${menuOpen ? "active" : ""}`}
                    onClick={() => setMenuOpen((open) => !open)}
                    title={t("player.settings")}
                    aria-label={t("player.settings")}
                    aria-expanded={menuOpen}
                >
                    <Icon name="sliders" />
                </button>
                {menuOpen && (
                    <div className={styles.menu} role="dialog" aria-label={t("player.settings")}>
                        <label className={styles.toggle}>
                            <input type="checkbox" checked={autoScroll} onChange={(e) => onAutoScrollChange(e.target.checked)} />
                            {t("player.autoscroll")}
                        </label>
                        <label className={styles.toggle}>
                            <input type="checkbox" checked={pauseOnWord} onChange={(e) => onPauseOnWordChange(e.target.checked)} />
                            {t("player.pause_on_word")}
                        </label>
                        {settings}
                    </div>
                )}
            </div>
        </div>
    );
}
