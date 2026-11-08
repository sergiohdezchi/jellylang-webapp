import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import AuthShell from "./AuthShell";
import styles from "./Auth.module.scss";

export default function LoginPage() {
    const { login } = useAuth();
    const { t } = useI18n();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            await login(email, password);
            navigate((location.state as { from?: string } | null)?.from ?? "/", { replace: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : t("common.error"));
        } finally {
            setBusy(false);
        }
    }

    return (
        <AuthShell>
            <h2>{t("auth.login.title")}</h2>
            <form onSubmit={handleSubmit}>
                {error && <div className="alert error">{error}</div>}
                <label className="field">
                    <span>{t("auth.email")}</span>
                    <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label className="field">
                    <span>{t("auth.password")}</span>
                    <input
                        className="input"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </label>
                <button className={`btn primary ${styles.submit}`} disabled={busy}>
                    {t("auth.login.submit")}
                </button>
            </form>
            <p className={styles.footer}>
                {t("auth.no_account")} <Link to="/signup">{t("auth.signup.submit")}</Link>
            </p>
            {import.meta.env.DEV && <p className={styles.hint}>{t("auth.demo_hint")}</p>}
        </AuthShell>
    );
}
