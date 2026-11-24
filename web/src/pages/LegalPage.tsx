import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { PRIVACY, TERMS } from "./legalContent";
import styles from "./LegalPage.module.scss";

/** Página pública (sin iniciar sesión) con las condiciones o la política de privacidad. */
export default function LegalPage({ kind }: { kind: "terms" | "privacy" }) {
    const { t, locale, setLocale } = useI18n();
    const doc = (kind === "terms" ? TERMS : PRIVACY)[locale];
    const other = kind === "terms" ? "/privacy" : "/terms";
    const otherTitle = (kind === "terms" ? PRIVACY : TERMS)[locale].title;

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <Link to="/" className={styles.brand}>
                    <img src="/mark.png" alt="" /> Jellylang
                </Link>
                <select className="select" style={{ width: "auto", minHeight: 32 }} value={locale} onChange={(e) => setLocale(e.target.value as "es" | "en")} aria-label="Language">
                    <option value="es">Español</option>
                    <option value="en">English</option>
                </select>
            </header>
            <main className={styles.content}>
                <h1>{doc.title}</h1>
                <p className="muted">{doc.updated}</p>
                <p>{doc.intro}</p>
                {doc.sections.map((section, index) => (
                    <section key={section.title}>
                        <h2>
                            {index + 1}. {section.title}
                        </h2>
                        {section.paragraphs?.map((text) => <p key={text}>{text}</p>)}
                        {section.items && (
                            <ul>
                                {section.items.map((item) => (
                                    <li key={item}>{item}</li>
                                ))}
                            </ul>
                        )}
                    </section>
                ))}
                <nav className={styles.links}>
                    <Link to={other}>{otherTitle}</Link>
                    <Link to="/">{t("legal.back")}</Link>
                </nav>
            </main>
        </div>
    );
}
