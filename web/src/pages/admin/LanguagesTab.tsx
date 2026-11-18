import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { AdminLanguage } from "../../api/types";
import { useI18n } from "../../i18n/I18nProvider";
import styles from "./Admin.module.scss";

export default function LanguagesTab() {
    const { t } = useI18n();
    const queryClient = useQueryClient();
    const [error, setError] = useState<string | null>(null);
    const [draft, setDraft] = useState({ code: "", name: "" });

    const { data: languages, isLoading } = useQuery({
        queryKey: ["admin", "languages"],
        queryFn: () => api<AdminLanguage[]>("/admin/languages"),
        staleTime: 0,
    });

    const handlers = {
        onSuccess: () => {
            setError(null);
            queryClient.invalidateQueries({ queryKey: ["admin", "languages"] });
            queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
            queryClient.invalidateQueries({ queryKey: ["languages"] }); // lista pública (registro, ajustes)
        },
        onError: (err: Error) => setError(err.message),
    };
    const create = useMutation({
        mutationFn: () => api<AdminLanguage>("/admin/languages", { method: "POST", body: draft }),
        ...handlers,
        onSuccess: () => {
            setDraft({ code: "", name: "" });
            handlers.onSuccess();
        },
    });
    const update = useMutation({
        mutationFn: ({ id, ...changes }: { id: number; name?: string; enabled?: boolean }) => api(`/admin/languages/${id}`, { method: "PATCH", body: changes }),
        ...handlers,
    });
    const remove = useMutation({ mutationFn: (id: number) => api(`/admin/languages/${id}`, { method: "DELETE" }), ...handlers });

    function submit(event: FormEvent) {
        event.preventDefault();
        create.mutate();
    }

    if (isLoading || !languages) return <div className="center-state"><div className="spinner" /></div>;

    return (
        <div className={styles.stack}>
            {error && <div className="alert error">{error}</div>}

            <form className={`card ${styles.addLanguage}`} onSubmit={submit}>
                <h2>{t("admin.add_language")}</h2>
                <div className={styles.addRow}>
                    <label className="field">
                        <span>{t("admin.code")}</span>
                        <input
                            className="input"
                            required
                            pattern="[A-Za-z]{2,3}"
                            maxLength={3}
                            placeholder="sv"
                            value={draft.code}
                            onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                        />
                    </label>
                    <label className="field">
                        <span>{t("admin.name")}</span>
                        <input className="input" required maxLength={60} placeholder="Svenska" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                    </label>
                    <button className="btn primary" disabled={create.isPending}>
                        {t("admin.create")}
                    </button>
                </div>
                <small className="muted">{t("admin.code_hint")}</small>
            </form>

            <div className={`card ${styles.tableCard}`}>
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>{t("admin.code")}</th>
                                <th>{t("admin.name")}</th>
                                <th className={styles.num}>{t("admin.col_users")}</th>
                                <th className={styles.num}>{t("admin.col_lessons")}</th>
                                <th>{t("admin.col_enabled")}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {languages.map((language) => {
                                const inUse = language.users_count + language.lessons_count > 0;
                                return (
                                    <tr key={language.id} className={language.enabled ? "" : styles.dimmed}>
                                        <td>
                                            <code>{language.code}</code>
                                        </td>
                                        <td>
                                            <input
                                                className={styles.inlineInput}
                                                defaultValue={language.name}
                                                aria-label={t("admin.name")}
                                                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                                                onBlur={(e) => {
                                                    const name = e.target.value.trim();
                                                    if (name && name !== language.name) update.mutate({ id: language.id, name });
                                                    else e.target.value = language.name;
                                                }}
                                            />
                                        </td>
                                        <td className={styles.num}>{language.users_count}</td>
                                        <td className={styles.num}>{language.lessons_count}</td>
                                        <td>
                                            <label className={styles.switch}>
                                                <input
                                                    type="checkbox"
                                                    role="switch"
                                                    checked={language.enabled}
                                                    onChange={(e) => update.mutate({ id: language.id, enabled: e.target.checked })}
                                                    aria-label={`${t("admin.col_enabled")}: ${language.name}`}
                                                />
                                                <span aria-hidden="true" />
                                            </label>
                                        </td>
                                        <td>
                                            <button
                                                className="btn small ghost danger"
                                                disabled={inUse || remove.isPending}
                                                title={inUse ? t("admin.language_in_use_hint") : undefined}
                                                onClick={() => window.confirm(t("admin.delete_language_confirm", { name: language.name })) && remove.mutate(language.id)}
                                            >
                                                {t("common.delete")}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            <p className="muted">{t("admin.languages_note")}</p>
        </div>
    );
}
