import { useId, useState } from "react";
import Icon from "../Icon";
import { useI18n } from "../../i18n/I18nProvider";
import type { MessageKey } from "../../i18n/messages";
import { BASIC_RULES, EXTRA_RULES, PASSWORD_MIN_LENGTH, checkPassword, passwordStrength } from "../../lib/passwordPolicy";
import styles from "./PasswordField.module.scss";

interface Props {
    label: string;
    value: string;
    onChange: (value: string) => void;
    autoComplete: "new-password" | "current-password";
    /** Muestra los requisitos y la fuerza (para contraseñas nuevas) */
    showRules?: boolean;
    /** Para comprobar que la contraseña no contiene el email */
    email?: string;
    /** Marca en rojo los requisitos que faltan (tras intentar enviar) */
    highlightErrors?: boolean;
}

const STRENGTH_KEYS: MessageKey[] = ["auth.pw.weak", "auth.pw.weak", "auth.pw.fair", "auth.pw.good", "auth.pw.strong"];

export default function PasswordField({ label, value, onChange, autoComplete, showRules = false, email = "", highlightErrors = false }: Props) {
    const { t } = useI18n();
    const [visible, setVisible] = useState(false);
    const rulesId = useId();
    const result = checkPassword(value, email);
    const strength = passwordStrength(value, email);
    // Las reglas extra solo aparecen cuando se incumplen, para no abrumar
    const rules = [...BASIC_RULES, ...EXTRA_RULES.filter((rule) => value && !result[rule])];

    return (
        <div className="field">
            <span>{label}</span>
            <div className={styles.wrapper}>
                <input
                    className={`input ${styles.input}`}
                    type={visible ? "text" : "password"}
                    autoComplete={autoComplete}
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    maxLength={72}
                    aria-label={label}
                    aria-describedby={showRules ? rulesId : undefined}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
                <button
                    type="button"
                    className={styles.toggle}
                    onClick={() => setVisible((v) => !v)}
                    aria-label={t(visible ? "auth.password_hide" : "auth.password_show")}
                    title={t(visible ? "auth.password_hide" : "auth.password_show")}
                >
                    <Icon name={visible ? "eyeOff" : "eye"} size={18} />
                </button>
            </div>

            {showRules && (
                <div id={rulesId} className={styles.rules} aria-live="polite">
                    <div className={styles.meter} data-strength={strength}>
                        <div className={styles.bars}>
                            {[1, 2, 3, 4].map((level) => (
                                <span key={level} className={strength >= level ? styles.on : ""} />
                            ))}
                        </div>
                        {value && <span className={styles.meterLabel}>{t(STRENGTH_KEYS[strength])}</span>}
                    </div>
                    <ul>
                        {rules.map((rule) => {
                            const ok = Boolean(value) && result[rule];
                            const state = ok ? styles.ok : highlightErrors ? styles.bad : "";
                            return (
                                <li key={rule} className={state}>
                                    <Icon name={ok ? "check" : highlightErrors ? "close" : "dot"} size={14} />
                                    {t(`auth.pw.${rule}` as MessageKey, { min: PASSWORD_MIN_LENGTH })}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}
