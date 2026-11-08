import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { useLanguages } from "../hooks/useLanguages";
import AuthShell from "./AuthShell";
import styles from "./Auth.module.scss";

export default function SignupPage() {
    const { signup } = useAuth();
    const { t, locale } = useI18n();
    const navigate = useNavigate();
    const { data: languages = [] } = useLanguages();
    const [form, setForm] = useState({ email: "", password: "", name: "", native_language: locale as string, study_language_id: "" });
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!form.study_language_id && languages.length > 0) {
            const others = languages.filter((l) => l.code !== form.native_language);
            const first = others.find((l) => l.code === "en") ?? others[0] ?? languages[0];
            setForm((f) => ({ ...f, study_language_id: String(first.id) }));
        }
    }, [languages, form.study_language_id, form.native_language]);

    const update = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            await signup({ ...form, ui_language: locale, study_language_id: Number(form.study_language_id) });
            navigate("/", { replace: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : t("common.error"));
        } finally {
            setBusy(false);
        }
    }

    return (
        <AuthShell>
            <h2>{t("auth.signup.title")}</h2>
            <form onSubmit={handleSubmit}>
                {error && <div className="alert error">{error}</div>}
                <label className="field">
                    <span>{t("auth.name")}</span>
                    <input className="input" autoComplete="name" value={form.name} onChange={update("name")} />
                </label>
                <label className="field">
                    <span>{t("auth.email")}</span>
                    <input className="input" type="email" autoComplete="email" required value={form.email} onChange={update("email")} />
                </label>
                <label className="field">
                    <span>{t("auth.password")}</span>
                    <input
                        className="input"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        required
                        placeholder={t("auth.password_hint")}
                        value={form.password}
                        onChange={update("password")}
                    />
                </label>
                <div className="form-row">
                    <label className="field">
                        <span>{t("auth.native_language")}</span>
                        <select className="select" value={form.native_language} onChange={update("native_language")}>
                            {languages.map((l) => (
                                <option key={l.id} value={l.code}>
                                    {l.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="field">
                        <span>{t("auth.study_language")}</span>
                        <select className="select" required value={form.study_language_id} onChange={update("study_language_id")}>
                            {languages.map((l) => (
                                <option key={l.id} value={l.id}>
                                    {l.name}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <button className={`btn primary ${styles.submit}`} disabled={busy}>
                    {t("auth.signup.submit")}
                </button>
            </form>
            <p className={styles.footer}>
                {t("auth.have_account")} <Link to="/login">{t("auth.login.submit")}</Link>
            </p>
        </AuthShell>
    );
}
