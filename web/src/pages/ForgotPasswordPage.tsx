import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import Icon from "../components/Icon";
import Captcha, { type CaptchaHandle } from "../components/Captcha/Captcha";
import { useConfig } from "../hooks/useConfig";
import PasswordField from "../components/PasswordField/PasswordField";
import { isPasswordValid } from "../lib/passwordPolicy";
import AuthShell from "./AuthShell";
import { formatCountdown } from "./VerifyEmailStep";
import styles from "./Auth.module.scss";

/** Recuperar la contraseña: 1) email → 2) código + contraseña nueva. */
export default function ForgotPasswordPage() {
    const { forgotPassword, resetPassword } = useAuth();
    const { t } = useI18n();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? "");
    const [step, setStep] = useState<"email" | "reset">("email");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const { data: config } = useConfig();
    const siteKey = config?.captcha_site_key ?? null;
    const [captcha, setCaptcha] = useState<string | null>(null);
    const captchaRef = useRef<CaptchaHandle>(null);
    const [tried, setTried] = useState(false);
    const [resendAt, setResendAt] = useState(0);
    const [lockedUntil, setLockedUntil] = useState(0);
    const [now, setNow] = useState(Date.now());

    const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
    const lockedFor = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
    const locked = lockedFor > 0;

    useEffect(() => {
        if (wait <= 0 && lockedFor <= 0) return;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [wait, lockedFor]);

    function fail(err: unknown) {
        if (err instanceof ApiError) {
            if (err.code === "locked" && typeof err.data.retry_in === "number") setLockedUntil(Date.now() + err.data.retry_in * 1000);
            if (typeof err.data.resend_in === "number") setResendAt(Date.now() + err.data.resend_in * 1000);
            setNow(Date.now());
        }
        setError(err instanceof Error ? err.message : t("common.error"));
    }

    async function sendCode(event?: FormEvent) {
        event?.preventDefault();
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const data = await forgotPassword(email.trim(), captcha);
            setResendAt(Date.now() + data.resend_in * 1000);
            setNow(Date.now());
            setStep("reset");
            setCode("");
        } catch (err) {
            fail(err);
        } finally {
            captchaRef.current?.reset();
            setBusy(false);
        }
    }

    async function submitReset(event: FormEvent) {
        event.preventDefault();
        setTried(true);
        if (!isPasswordValid(password, email)) return setError(t("auth.pw.invalid"));
        setBusy(true);
        setError(null);
        try {
            await resetPassword(email.trim(), code, password);
            navigate("/", { replace: true });
        } catch (err) {
            fail(err);
            if (err instanceof ApiError && err.code !== "locked" && !err.details) setCode("");
        } finally {
            setBusy(false);
        }
    }

    if (step === "email") {
        return (
            <AuthShell>
                <h2>{t("auth.forgot.title")}</h2>
                <p className={styles.verifyText}>{t("auth.forgot.intro")}</p>
                <form onSubmit={sendCode}>
                    {error && <div className="alert error">{error}</div>}
                    <label className="field">
                        <span>{t("auth.email")}</span>
                        <input className="input" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
                    </label>
                    {siteKey && <Captcha ref={captchaRef} siteKey={siteKey} onChange={setCaptcha} />}
                    <button className={`btn primary ${styles.submit}`} disabled={busy || (Boolean(siteKey) && !captcha)}>
                        {t("auth.forgot.send")}
                    </button>
                </form>
                <p className={styles.footer}>
                    <Link to="/login">{t("auth.forgot.back_login")}</Link>
                </p>
            </AuthShell>
        );
    }

    return (
        <AuthShell>
            <div className={styles.verify}>
                <div className={styles.verifyIcon}>
                    <Icon name="mail" size={26} />
                </div>
                <h2>{t("auth.forgot.reset_title")}</h2>
                <p className={styles.verifyText}>
                    {t("auth.forgot.sent")} <strong>{email}</strong>{t("auth.forgot.sent_end")} {t("auth.verify.expires")}
                </p>
                <form onSubmit={submitReset}>
                    {error && <div className="alert error">{error}</div>}
                    {notice && <div className="alert info">{notice}</div>}
                    {locked && <div className="alert warning">{t("auth.locked_countdown", { time: formatCountdown(lockedFor) })}</div>}
                    <label className="field">
                        <span>{t("auth.verify.code")}</span>
                        <input
                            className={`input ${styles.codeInput}`}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={8}
                            placeholder="000000"
                            autoFocus
                            required
                            disabled={locked}
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        />
                    </label>
                    <PasswordField
                        label={t("auth.forgot.new_password")}
                        autoComplete="new-password"
                        showRules
                        email={email}
                        highlightErrors={tried}
                        value={password}
                        onChange={setPassword}
                    />
                    <button className={`btn primary ${styles.submit}`} disabled={busy || locked || code.length !== 6}>
                        {busy ? t("common.loading") : t("auth.forgot.submit")}
                    </button>
                </form>
                <p className={styles.resend}>
                    {t("auth.verify.not_received")}{" "}
                    <button type="button" className={styles.linkButton} onClick={() => setStep("email")} disabled={wait > 0 || locked || busy}>
                        {wait > 0 ? t("auth.verify.resend_in", { seconds: wait }) : t("auth.verify.resend")}
                    </button>
                </p>
                {import.meta.env.DEV && (
                    <p className={styles.devHint}>
                        {t("auth.verify.dev_mailpit")}{" "}
                        <a href={import.meta.env.VITE_MAILPIT_URL ?? "http://localhost:8025"} target="_blank" rel="noreferrer">
                            Mailpit <Icon name="external" size={12} />
                        </a>
                    </p>
                )}
                <p className={styles.footer}>
                    <button type="button" className={styles.linkButton} onClick={() => setStep("email")}>
                        <Icon name="arrowLeft" size={14} /> {t("auth.verify.back")}
                    </button>
                </p>
            </div>
        </AuthShell>
    );
}
