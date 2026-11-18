import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { AdminSetting, SettingKey } from "../../api/types";
import { useI18n } from "../../i18n/I18nProvider";
import type { MessageKey } from "../../i18n/messages";
import styles from "./Admin.module.scss";

const TEXTS: Record<SettingKey, { title: MessageKey; help: MessageKey }> = {
    ytdlp_enabled: { title: "admin.setting_ytdlp", help: "admin.setting_ytdlp_help" },
    signups_enabled: { title: "admin.setting_signups", help: "admin.setting_signups_help" },
};

export default function SettingsTab() {
    const { t, locale } = useI18n();
    const queryClient = useQueryClient();
    const [error, setError] = useState<string | null>(null);

    const { data: settings, isLoading } = useQuery({
        queryKey: ["admin", "settings"],
        queryFn: () => api<AdminSetting[]>("/admin/settings"),
        staleTime: 0,
    });

    const onDone = {
        onSuccess: () => {
            setError(null);
            queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
            // La interfaz (importar por URL, registro) lee estos valores de /config
            queryClient.invalidateQueries({ queryKey: ["config"] });
        },
        onError: (err: Error) => setError(err.message),
    };
    const update = useMutation({
        mutationFn: ({ key, value }: { key: SettingKey; value: boolean }) => api(`/admin/settings/${key}`, { method: "PATCH", body: { value } }),
        ...onDone,
    });
    const reset = useMutation({ mutationFn: (key: SettingKey) => api(`/admin/settings/${key}`, { method: "DELETE" }), ...onDone });

    if (isLoading || !settings) return <div className="center-state"><div className="spinner" /></div>;

    const sourceLabel = (setting: AdminSetting) =>
        setting.source === "panel"
            ? t("admin.source_panel", {
                  date: setting.updated_at ? new Date(setting.updated_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "",
              })
            : setting.source === "env"
              ? t("admin.source_env", { env: setting.env })
              : t("admin.source_default");

    return (
        <div className={styles.stack}>
            {error && <div className="alert error">{error}</div>}
            {settings.map((setting) => (
                <section key={setting.key} className={`card ${styles.setting}`}>
                    <div className={styles.settingText}>
                        <h2>{t(TEXTS[setting.key].title)}</h2>
                        <p className="muted">{t(TEXTS[setting.key].help)}</p>
                        <small className={styles.source}>
                            {sourceLabel(setting)}
                            {setting.source === "panel" && (
                                <button className="btn ghost small" disabled={reset.isPending} onClick={() => reset.mutate(setting.key)}>
                                    {t("admin.reset", { env: setting.env })}
                                </button>
                            )}
                        </small>
                    </div>
                    <label className={styles.switch}>
                        <input
                            type="checkbox"
                            role="switch"
                            checked={setting.value}
                            disabled={update.isPending}
                            onChange={(e) => update.mutate({ key: setting.key, value: e.target.checked })}
                            aria-label={t(TEXTS[setting.key].title)}
                        />
                        <span aria-hidden="true" />
                        <strong>{setting.value ? t("admin.on") : t("admin.off")}</strong>
                    </label>
                </section>
            ))}
        </div>
    );
}
