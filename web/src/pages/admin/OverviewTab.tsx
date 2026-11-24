import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { AdminOverview } from "../../api/types";
import { useI18n } from "../../i18n/I18nProvider";
import { formatNumber } from "../../lib/format";
import styles from "./Admin.module.scss";

export default function OverviewTab() {
    const { t, locale } = useI18n();
    const { data, isLoading, error } = useQuery({
        queryKey: ["admin", "overview"],
        queryFn: () => api<AdminOverview>("/admin/overview"),
        staleTime: 0,
    });

    if (isLoading) return <div className="center-state"><div className="spinner" /></div>;
    if (error || !data) return <div className="alert error">{error?.message ?? t("common.error")}</div>;

    const n = (value: number) => formatNumber(value, locale);
    const tiles = [
        { label: t("admin.users"), value: n(data.users.total), detail: t("admin.users_detail", { admins: data.users.admins, disabled: data.users.disabled }) },
        { label: t("admin.active_week"), value: n(data.users.active_this_week), detail: t("admin.new_week", { count: data.users.new_this_week }) },
        { label: t("admin.lessons"), value: n(data.lessons.total), detail: t("admin.lessons_detail", { youtube: data.lessons.youtube }) },
        {
            label: t("admin.failed_count"),
            value: n(data.lessons.failed),
            detail: t("admin.processing_count", { count: data.lessons.processing }),
            warn: data.lessons.failed > 0,
        },
        { label: t("stats.jellies"), value: n(data.jellies), detail: t("admin.reviews_week", { count: n(data.reviews_this_week) }) },
        { label: t("admin.tab_languages"), value: n(data.languages), detail: t("admin.languages_enabled") },
    ];

    const date = (value: string) => new Date(value).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });

    return (
        <div className={styles.stack}>
            <section className={styles.tiles}>
                {tiles.map((tile) => (
                    <div key={tile.label} className={`${styles.tile} ${tile.warn ? styles.warn : ""}`}>
                        <span className={styles.tileLabel}>{tile.label}</span>
                        <span className={styles.tileValue}>{tile.value}</span>
                        <span className={styles.tileDetail}>{tile.detail}</span>
                    </div>
                ))}
            </section>

            <section className="card">
                <h2>{t("admin.failed_imports")}</h2>
                {data.failed_imports.length === 0 ? (
                    <p className="muted">{t("admin.failed_none")}</p>
                ) : (
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>{t("admin.col_lesson")}</th>
                                    <th>{t("admin.col_user")}</th>
                                    <th>{t("admin.col_error")}</th>
                                    <th>{t("admin.col_date")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.failed_imports.map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            {item.youtube_id ? (
                                                <a href={`https://www.youtube.com/watch?v=${item.youtube_id}`} target="_blank" rel="noreferrer">
                                                    {item.title}
                                                </a>
                                            ) : (
                                                item.title
                                            )}
                                        </td>
                                        <td>{item.user_email}</td>
                                        <td className={styles.errorCell}>{item.error_message}</td>
                                        <td className={styles.nowrap}>{date(item.updated_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
