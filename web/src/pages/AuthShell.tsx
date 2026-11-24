import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import styles from "./Auth.module.scss";

export default function AuthShell({ children }: { children: ReactNode }) {
    const { t, locale, setLocale } = useI18n();

    return (
        <div className={styles.page}>
            <section className={styles.hero}>
                <h1>{t("app.tagline")}</h1>
                <p className={styles.sample}>
                    The <span className={styles.highlightWord}>lighthouse</span> keeper climbed the{" "}
                    <span className={styles.new}>spiral</span> stairs as the storm{" "}
                    <span className={styles.new}>rattled</span> the windows.
                </p>
            </section>
            <section className={styles.formSide}>
                <div className={styles.form}>
                    <div className={styles.brand}>
                        <img src="/mark.png" alt="" className={styles.mark} /> Jellylang
                        <select
                            className="select"
                            style={{ width: "auto", marginLeft: "auto", minHeight: 32 }}
                            value={locale}
                            onChange={(e) => setLocale(e.target.value as "es" | "en")}
                            aria-label="Language"
                        >
                            <option value="es">Español</option>
                            <option value="en">English</option>
                        </select>
                    </div>
                    {children}
                    <p className={styles.legal}>
                        <Link to="/terms">{t("legal.terms")}</Link> · <Link to="/privacy">{t("legal.privacy")}</Link>
                    </p>
                </div>
            </section>
        </div>
    );
}
