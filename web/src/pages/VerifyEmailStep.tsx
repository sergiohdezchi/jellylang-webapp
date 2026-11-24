import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError } from "../api/client";
import { useAuth, type PendingVerification } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import Icon from "../components/Icon";
import styles from "./Auth.module.scss";

const CODE_LENGTH = 6;

/** 872 s → "14:32" */
export const formatCountdown = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
// En desarrollo los correos no salen a internet: los recoge Mailpit (docker-compose.yml)
const MAILPIT_URL: string = import.meta.env.VITE_MAILPIT_URL ?? "http://localhost:8025";

interface Props {
    pending: PendingVerification;
    /** La contraseña se queda en memoria: la API la pide junto al código */
    password: string;
    onBack: () => void;
}

/** Último paso del registro: el código de 6 dígitos que llega por correo. */
export default function VerifyEmailStep({ pending, password, onBack }: Props) {
    const { verifyEmail, resendCode } = useAuth();
    const { t } = useI18n();
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [resendAt, setResendAt] = useState(() => Date.now() + pending.resend_in * 1000);
    const [now, setNow] = useState(Date.now());
    const inputRef = useRef<HTMLInputElement>(null);
    const lastSubmitted = useRef("");

    // Demasiados intentos: todo queda bloqueado hasta que pase el tiempo que indica la API
    const [lockedUntil, setLockedUntil] = useState(0);

    const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
    const lockedFor = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
    const locked = lockedFor > 0;

    useEffect(() => {
        if (wait <= 0 && lockedFor <= 0) return;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [wait, lockedFor]);

    async function submit(value: string) {
        if (value.length !== CODE_LENGTH || busy) return;
        lastSubmitted.current = value;
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            await verifyEmail(pending.email, password, value);
        } catch (err) {
            noteLock(err);
            setError(err instanceof Error ? err.message : t("common.error"));
            setCode("");
            inputRef.current?.focus();
        } finally {
            setBusy(false);
        }
    }

    function noteLock(err: unknown) {
        if (err instanceof ApiError && err.code === "locked" && typeof err.data.retry_in === "number") {
            setLockedUntil(Date.now() + err.data.retry_in * 1000);
            setNow(Date.now());
        }
    }

    function handleChange(raw: string) {
        // Acepta el código pegado con espacios o guiones ("482 913")
        const digits = raw.replace(/\D/g, "").slice(0, CODE_LENGTH);
        setCode(digits);
        if (digits.length === CODE_LENGTH && digits !== lastSubmitted.current) submit(digits);
    }

    async function resend() {
        setError(null);
        setNotice(null);
        try {
            const data = await resendCode(pending.email, password);
            setResendAt(Date.now() + data.resend_in * 1000);
            setNow(Date.now());
            setNotice(t("auth.verify.resent"));
            lastSubmitted.current = "";
            setCode("");
            inputRef.current?.focus();
        } catch (err) {
            noteLock(err);
            if (err instanceof ApiError && typeof err.data.resend_in === "number") {
                setResendAt(Date.now() + err.data.resend_in * 1000);
                setNow(Date.now());
            }
            setError(err instanceof Error ? err.message : t("common.error"));
        }
    }

    return (
        <div className={styles.verify}>
            <div className={styles.verifyIcon}>
                <Icon name="mail" size={26} />
            </div>
            <h2>{t("auth.verify.title")}</h2>
            <p className={styles.verifyText}>
                {t("auth.verify.sent")} <strong>{pending.email}</strong>. {t("auth.verify.expires")}
            </p>

            <form
                onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    submit(code);
                }}
            >
                {error && <div className="alert error">{error}</div>}
                {locked && (
                    <div className="alert warning">{t("auth.locked_countdown", { time: formatCountdown(lockedFor) })}</div>
                )}
                {notice && <div className="alert info">{notice}</div>}
                <label className="field">
                    <span>{t("auth.verify.code")}</span>
                    <input
                        ref={inputRef}
                        className={`input ${styles.codeInput}`}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="\d{6}"
                        maxLength={CODE_LENGTH + 2}
                        placeholder="000000"
                        autoFocus
                        required
                        disabled={locked}
                        value={code}
                        onChange={(e) => handleChange(e.target.value)}
                    />
                </label>
                <button className={`btn primary ${styles.submit}`} disabled={busy || locked || code.length !== CODE_LENGTH}>
                    {busy ? t("common.loading") : t("auth.verify.submit")}
                </button>
            </form>

            <p className={styles.resend}>
                {t("auth.verify.not_received")}{" "}
                <button type="button" className={styles.linkButton} onClick={resend} disabled={wait > 0 || locked}>
                    {wait > 0 ? t("auth.verify.resend_in", { seconds: wait }) : t("auth.verify.resend")}
                </button>
            </p>

            {import.meta.env.DEV && (
                <p className={styles.devHint}>
                    {t("auth.verify.dev_mailpit")}{" "}
                    <a href={MAILPIT_URL} target="_blank" rel="noreferrer">
                        Mailpit <Icon name="external" size={12} />
                    </a>
                </p>
            )}

            <p className={styles.footer}>
                <button type="button" className={styles.linkButton} onClick={onBack}>
                    <Icon name="arrowLeft" size={14} /> {t("auth.verify.back")}
                </button>
            </p>
        </div>
    );
}
