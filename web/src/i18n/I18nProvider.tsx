import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { messages, type Locale, type MessageKey } from "./messages";

type Vars = Record<string, string | number>;

interface I18nValue {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: MessageKey, vars?: Vars) => string;
}

const STORAGE_KEY = "linguaq.locale";
const I18nContext = createContext<I18nValue | null>(null);

function initialLocale(): Locale {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "es" || stored === "en") return stored;
    } catch {
        // sin almacenamiento
    }
    return navigator.language.startsWith("en") ? "en" : "es";
}

export function I18nProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>(initialLocale);

    const setLocale = useCallback((value: Locale) => {
        setLocaleState(value);
        try {
            localStorage.setItem(STORAGE_KEY, value);
        } catch {
            // sin almacenamiento
        }
    }, []);

    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);

    const t = useCallback(
        (key: MessageKey, vars?: Vars) => {
            const template = messages[locale][key] ?? key;
            return vars ? template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`)) : template;
        },
        [locale],
    );

    const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
    const context = useContext(I18nContext);
    if (!context) throw new Error("useI18n debe usarse dentro de I18nProvider");
    return context;
}
