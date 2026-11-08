import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { DayStats, Stats } from "../api/types";
import { useLanguage } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/messages";
import { formatNumber } from "../lib/format";
import Icon from "../components/Icon";
import styles from "./StatsPage.module.scss";

type Metric = "new_lingqs" | "words_read" | "known_words" | "listening" | "reviews";

const METRICS: { id: Metric; label: MessageKey; value: (d: DayStats) => number }[] = [
    { id: "new_lingqs", label: "stats.metric_new_lingqs", value: (d) => d.new_lingqs },
    { id: "words_read", label: "stats.metric_words_read", value: (d) => d.words_read },
    { id: "known_words", label: "stats.metric_known_words", value: (d) => d.known_words },
    { id: "listening", label: "stats.metric_listening", value: (d) => Math.round(d.listening_seconds / 60) },
    { id: "reviews", label: "stats.metric_reviews", value: (d) => d.reviews },
];

/** Techo del eje: par y "redondo" para que la línea de la mitad sea un entero. */
function niceMax(value: number): number {
    if (value <= 2) return 2;
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const step = [1, 2, 5, 10].map((f) => f * magnitude).find((s) => s >= value / 2) ?? magnitude * 10;
    return step * 2;
}

export default function StatsPage() {
    const language = useLanguage();
    const { t, locale } = useI18n();
    const [metricId, setMetricId] = useState<Metric>("new_lingqs");
    const [hovered, setHovered] = useState<number | null>(null);

    const { data: stats, isLoading } = useQuery({
        queryKey: ["stats", language.id],
        queryFn: () => api<Stats>("/stats", { query: { language_id: language.id } }),
        staleTime: 0,
    });

    if (isLoading || !stats) {
        return (
            <div className="center-state">
                <div className="spinner" />
            </div>
        );
    }

    const n = (value: number) => formatNumber(value, locale);
    const metric = METRICS.find((m) => m.id === metricId)!;
    const values = stats.week.map(metric.value);
    const max = niceMax(Math.max(...values));
    const dayLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(locale, { weekday: "short" });
    const fullDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "short" });
    const goalDone = stats.today.new_lingqs;
    const goalPct = Math.min(100, Math.round((goalDone / stats.daily_goal) * 100));

    const tiles = [
        { label: t("stats.known_words"), value: n(stats.known_words) },
        { label: t("stats.lingqs"), value: n(stats.lingqs) },
        { label: t("stats.streak"), value: t("stats.days", { count: stats.streak }), icon: "flame" as const },
        { label: t("stats.words_read"), value: n(stats.words_read) },
        { label: t("stats.listening"), value: (stats.listening_seconds / 3600).toLocaleString(locale, { maximumFractionDigits: 1 }) },
        { label: t("stats.due"), value: n(stats.due_reviews) },
    ];

    return (
        <div className="container">
            <div className="page-header">
                <h1>
                    {t("stats.title")} <span className="muted">· {language.name}</span>
                </h1>
                {stats.due_reviews > 0 && (
                    <Link to="/review" className="btn primary">
                        <Icon name="cards" /> {t("stats.review_now")}
                    </Link>
                )}
            </div>

            <section className={styles.tiles}>
                {tiles.map((tile) => (
                    <div key={tile.label} className={styles.tile}>
                        <span className={styles.tileLabel}>
                            {tile.icon && <Icon name={tile.icon} size={14} />} {tile.label}
                        </span>
                        <span className={styles.tileValue}>{tile.value}</span>
                    </div>
                ))}
            </section>

            <div className={styles.columns}>
                <section className={`card ${styles.goal}`}>
                    <h2>{t("stats.goal_title")}</h2>
                    <div
                        className={styles.ring}
                        style={{ "--pct": `${goalPct}%` } as React.CSSProperties}
                        role="progressbar"
                        aria-valuenow={goalDone}
                        aria-valuemin={0}
                        aria-valuemax={stats.daily_goal}
                    >
                        <span>{goalPct}%</span>
                    </div>
                    <p>{goalPct >= 100 ? t("stats.goal_done") : t("stats.goal_text", { done: goalDone, goal: stats.daily_goal })}</p>
                </section>

                <section className={`card ${styles.chartCard}`}>
                    <div className={styles.chartHeader}>
                        <h2>{t("stats.week")}</h2>
                        <select className="select" value={metricId} onChange={(e) => setMetricId(e.target.value as Metric)} aria-label={t("stats.week")}>
                            {METRICS.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {t(m.label)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.chart} aria-hidden="true" onMouseLeave={() => setHovered(null)}>
                        {[1, 0.5].map((f) => (
                            <div key={f} className={styles.gridline} style={{ bottom: `${f * 100}%` }}>
                                <span>{n(Math.round(max * f))}</span>
                            </div>
                        ))}
                        {stats.week.map((day, i) => (
                            <div
                                key={day.date}
                                className={`${styles.barSlot} ${hovered === i ? styles.hover : ""}`}
                                onMouseEnter={() => setHovered(i)}
                            >
                                {hovered === i && (
                                    <div className={styles.tooltip}>
                                        <strong>{n(values[i])}</strong>
                                        <span>{fullDate(day.date)}</span>
                                    </div>
                                )}
                                <div className={styles.bar} style={{ height: `${(values[i] / max) * 100}%` }} />
                            </div>
                        ))}
                    </div>
                    <div className={styles.axis} aria-hidden="true">
                        {stats.week.map((day, i) => (
                            <span key={day.date} className={i === stats.week.length - 1 ? styles.today : ""}>
                                {dayLabel(day.date)}
                            </span>
                        ))}
                    </div>

                    <table className="visually-hidden">
                        <caption>
                            {t("stats.week")} — {t(metric.label)}
                        </caption>
                        <tbody>
                            {stats.week.map((day, i) => (
                                <tr key={day.date}>
                                    <th scope="row">{fullDate(day.date)}</th>
                                    <td>{values[i]}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            </div>
        </div>
    );
}
