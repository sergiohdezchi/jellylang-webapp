import { useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth, type PendingVerification } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { useConfig } from "../hooks/useConfig";
import Captcha, { type CaptchaHandle } from "../components/Captcha/Captcha";
import PasswordField from "../components/PasswordField/PasswordField";
import AuthShell from "./AuthShell";
import VerifyEmailStep from "./VerifyEmailStep";
import styles from "./Auth.module.scss";

export default function LoginPage() {
    const { login } = useAuth();
    const { t } = useI18n();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const { data: config } = useConfig();
    const [busy, setBusy] = useState(false);
    const [captcha, setCaptcha] = useState<string | null>(null);
    const captchaRef = useRef<CaptchaHandle>(null);
    const siteKey = config?.captcha_site_key ?? null;
    const [pending, setPending] = useState<PendingVerification | null>(null);

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            await login(email, password, captcha);
            navigate((location.state as { from?: string } | null)?.from ?? "/", { replace: true });
        } catch (err) {
            // Registro sin terminar: la API ya envió (o tiene vigente) un código
            if (err instanceof ApiError && err.code === "email_not_verified") {
                setPending({ verification_required: true, email: String(err.data.email ?? email), resend_in: Number(err.data.resend_in ?? 0) });
                return;
            }
            setError(err instanceof Error ? err.message : t("common.error"));
        } finally {
            captchaRef.current?.reset();
            setBusy(false);
        }
    }

    if (pending) {
        return (
            <AuthShell>
                <VerifyEmailStep pending={pending} password={password} onBack={() => setPending(null)} />
            </AuthShell>
        );
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
                <PasswordField label={t("auth.password")} autoComplete="current-password" value={password} onChange={setPassword} />
                {siteKey && <Captcha ref={captchaRef} siteKey={siteKey} onChange={setCaptcha} />}
                <div className={styles.forgot}>
                    <Link to="/forgot-password" state={{ email }}>
                        {t("auth.forgot.link")}
                    </Link>
                </div>
                <button className={`btn primary ${styles.submit}`} disabled={busy || (Boolean(siteKey) && !captcha)}>
                    {t("auth.login.submit")}
                </button>
            </form>
            <p className={styles.footer} hidden={config?.signups_enabled === false}>
                {t("auth.no_account")} <Link to="/signup">{t("auth.signup.submit")}</Link>
            </p>
        </AuthShell>
    );
}
