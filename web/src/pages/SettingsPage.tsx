import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { useLanguages } from "../hooks/useLanguages";
import type { Locale } from "../i18n/messages";
import styles from "./SettingsPage.module.scss";

interface StudyRow {
    language_id: number;
    daily_goal: number;
}

export default function SettingsPage() {
    const { user, updateUser } = useAuth();
    const { t, setLocale } = useI18n();
    const { data: languages = [] } = useLanguages();
    const [name, setName] = useState(user?.name ?? "");
    const [uiLanguage, setUiLanguage] = useState<Locale>(user?.ui_language ?? "es");
    const [nativeLanguage, setNativeLanguage] = useState(user?.native_language ?? "es");
    const [rows, setRows] = useState<StudyRow[]>([]);
    const [currentId, setCurrentId] = useState<number | null>(user?.current_language?.id ?? null);
    const [message, setMessage] = useState<{ type: "info" | "error"; text: string } | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (user) setRows(user.languages.map((l) => ({ language_id: l.language.id, daily_goal: l.daily_goal })));
    }, [user]);

    if (!user) return null;

    const available = languages.filter((l) => !rows.some((r) => r.language_id === l.id));
    // Un idioma desactivado ya no viene en /languages, pero quien lo estudia debe seguir viendo su nombre
    const languageName = (id: number) =>
        languages.find((l) => l.id === id)?.name ?? user.languages.find((l) => l.language.id === id)?.language.name ?? "";

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (rows.length === 0) {
            setMessage({ type: "error", text: t("settings.onboarding") });
            return;
        }
        setBusy(true);
        setMessage(null);
        try {
            const current = rows.some((r) => r.language_id === currentId) ? currentId : rows[0].language_id;
            await updateUser({
                name,
                ui_language: uiLanguage,
                native_language: nativeLanguage,
                study_languages: rows,
                current_language_id: current,
            });
            setLocale(uiLanguage);
            setMessage({ type: "info", text: t("settings.saved") });
        } catch (err) {
            setMessage({ type: "error", text: err instanceof Error ? err.message : t("common.error") });
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="container">
            <form className={styles.wrapper} onSubmit={handleSubmit}>
                <div className="page-header">
                    <h1>{t("settings.title")}</h1>
                </div>

                {!user.current_language && <div className="alert info">{t("settings.onboarding")}</div>}
                {message && <div className={`alert ${message.type}`}>{message.text}</div>}

                <section className="card">
                    <h2>{t("settings.profile")}</h2>
                    <label className="field">
                        <span>{t("auth.name")}</span>
                        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                    </label>
                    <div className="form-row">
                        <label className="field">
                            <span>{t("settings.ui_language")}</span>
                            <select className="select" value={uiLanguage} onChange={(e) => setUiLanguage(e.target.value as Locale)}>
                                <option value="es">Español</option>
                                <option value="en">English</option>
                            </select>
                        </label>
                        <label className="field">
                            <span>{t("settings.native_language")}</span>
                            <select className="select" value={nativeLanguage} onChange={(e) => setNativeLanguage(e.target.value)}>
                                {languages.map((l) => (
                                    <option key={l.id} value={l.code}>
                                        {l.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                </section>

                <section className="card">
                    <h2>{t("settings.study_languages")}</h2>
                    <ul className={styles.languages}>
                        {rows.map((row) => (
                            <li key={row.language_id}>
                                <strong>{languageName(row.language_id)}</strong>
                                <label className={styles.goal}>
                                    <span className="muted">{t("settings.daily_goal")}</span>
                                    <input
                                        className="input"
                                        type="number"
                                        min={1}
                                        max={500}
                                        value={row.daily_goal}
                                        onChange={(e) =>
                                            setRows((list) =>
                                                list.map((r) => (r.language_id === row.language_id ? { ...r, daily_goal: Number(e.target.value) } : r)),
                                            )
                                        }
                                    />
                                </label>
                                {currentId === row.language_id ? (
                                    <span className="badge accent">{t("settings.current")}</span>
                                ) : (
                                    <button type="button" className="btn small" onClick={() => setCurrentId(row.language_id)}>
                                        {t("settings.make_current")}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="btn small ghost danger"
                                    onClick={() => setRows((list) => list.filter((r) => r.language_id !== row.language_id))}
                                >
                                    {t("settings.remove")}
                                </button>
                            </li>
                        ))}
                    </ul>
                    {available.length > 0 && (
                        <select
                            className="select"
                            value=""
                            onChange={(e) => {
                                const id = Number(e.target.value);
                                setRows((list) => [...list, { language_id: id, daily_goal: 20 }]);
                                if (!currentId) setCurrentId(id);
                            }}
                        >
                            <option value="">+ {t("settings.add_language")}</option>
                            {available.map((l) => (
                                <option key={l.id} value={l.id}>
                                    {l.name}
                                </option>
                            ))}
                        </select>
                    )}
                </section>

                <div className={styles.actions}>
                    <button className="btn primary" disabled={busy}>
                        {t("common.save")}
                    </button>
                </div>
            </form>
        </div>
    );
}
