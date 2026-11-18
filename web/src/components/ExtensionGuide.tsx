import { useI18n } from "../i18n/I18nProvider";
import styles from "./ExtensionGuide.module.scss";

/** Cómo importar videos con la extensión del navegador (la vía oficial para YouTube). */
export default function ExtensionGuide({ embedded = false }: { embedded?: boolean }) {
    const { t } = useI18n();

    return (
        <div className={embedded ? styles.embedded : `card ${styles.guide}`}>
            {!embedded && <h2>{t("import.extension_title")}</h2>}
            <p className="muted">{t("import.extension_intro")}</p>
            <ol>
                <li>{t("import.extension_step1")}</li>
                <li>{t("import.extension_step2")}</li>
                <li>{t("import.extension_step3")}</li>
                <li>{t("import.extension_step4")}</li>
            </ol>
            <small className="muted">{t("import.extension_note")}</small>
        </div>
    );
}
