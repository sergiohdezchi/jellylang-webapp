import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, type PendingVerification } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { useConfig } from "../hooks/useConfig";
import { useLanguages } from "../hooks/useLanguages";
import Captcha, { type CaptchaHandle } from "../components/Captcha/Captcha";
import PasswordField from "../components/PasswordField/PasswordField";
import { isPasswordValid } from "../lib/passwordPolicy";
import AuthShell from "./AuthShell";
import VerifyEmailStep from "./VerifyEmailStep";
import styles from "./Auth.module.scss";

export default function SignupPage() {
    const { signup } = useAuth();
    const { t, locale } = useI18n();
    const navigate = useNavigate();
    const { data: languages = [] } = useLanguages();
    const { data: config } = useConfig();
    const closed = config?.signups_enabled === false;
    const [form, setForm] = useState({ email: "", password: "", name: "", native_language: locale as string, study_language_id: "" });
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [captcha, setCaptcha] = useState<string | null>(null);
    const captchaRef = useRef<CaptchaHandle>(null);
    const siteKey = config?.captcha_site_key ?? null;
    const [triedSubmit, setTriedSubmit] = useState(false);
    const [pending, setPending] = useState<PendingVerification | null>(null);

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
        setTriedSubmit(true);
        if (!isPasswordValid(form.password, form.email)) {
            setError(t("auth.pw.invalid"));
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const result = await signup({ ...form, ui_language: locale, study_language_id: Number(form.study_language_id), captcha_token: captcha });
            if (result) setPending(result);
            else navigate("/", { replace: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : t("common.error"));
        } finally {
            captchaRef.current?.reset();
            setBusy(false);
        }
    }

    if (pending) {
        return (
            <AuthShell>
                <VerifyEmailStep pending={pending} password={form.password} onBack={() => setPending(null)} />
            </AuthShell>
        );
    }

    return (
        <AuthShell>
            <h2>{t("auth.signup.title")}</h2>
            {closed && <div className="alert info">{t("auth.signups_closed")}</div>}
            <form onSubmit={handleSubmit} hidden={closed}>
                {error && <div className="alert error">{error}</div>}
                <label className="field">
                    <span>{t("auth.name")}</span>
                    <input className="input" autoComplete="name" value={form.name} onChange={update("name")} />
                </label>
                <label className="field">
                    <span>{t("auth.email")}</span>
                    <input className="input" type="email" autoComplete="email" required value={form.email} onChange={update("email")} />
                </label>
                <PasswordField
                    label={t("auth.password")}
                    autoComplete="new-password"
                    showRules
                    email={form.email}
                    highlightErrors={triedSubmit}
                    value={form.password}
                    onChange={(password) => setForm((f) => ({ ...f, password }))}
                />
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
                {siteKey && <Captcha ref={captchaRef} siteKey={siteKey} onChange={setCaptcha} />}
                <button className={`btn primary ${styles.submit}`} disabled={busy || (Boolean(siteKey) && !captcha)}>
                    {t("auth.signup.submit")}
                </button>
            </form>
            <p className={styles.footer}>
                {t("auth.have_account")} <Link to="/login">{t("auth.login.submit")}</Link>
            </p>
        </AuthShell>
    );
}
