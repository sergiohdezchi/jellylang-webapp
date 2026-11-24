import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useI18n } from "../../i18n/I18nProvider";

declare global {
    interface Window {
        grecaptcha?: {
            render: (el: HTMLElement, options: Record<string, unknown>) => number;
            reset: (id?: number) => void;
        };
        __recaptchaReady?: () => void;
    }
}

export interface CaptchaHandle {
    /** Cada token sirve una sola vez: se llama tras cada envío */
    reset: () => void;
}

interface Props {
    siteKey: string;
    /** Recibe el token al resolver el desafío, y null si caduca */
    onChange: (token: string | null) => void;
}

let scriptPromise: Promise<void> | null = null;

function loadScript(locale: string) {
    scriptPromise ??= new Promise<void>((resolve, reject) => {
        window.__recaptchaReady = () => resolve();
        const script = document.createElement("script");
        script.src = `https://www.google.com/recaptcha/api.js?onload=__recaptchaReady&render=explicit&hl=${locale}`;
        script.async = true;
        script.onerror = () => {
            scriptPromise = null; // permite reintentar
            reject(new Error("reCAPTCHA no se pudo cargar"));
        };
        document.head.appendChild(script);
    });
    return scriptPromise;
}

/** Casilla «No soy un robot» de reCAPTCHA v2. */
const Captcha = forwardRef<CaptchaHandle, Props>(function Captcha({ siteKey, onChange }, ref) {
    const { locale } = useI18n();
    const container = useRef<HTMLDivElement>(null);
    const widgetId = useRef<number | null>(null);
    const callback = useRef(onChange);
    callback.current = onChange;

    useImperativeHandle(ref, () => ({
        reset() {
            if (widgetId.current !== null) window.grecaptcha?.reset(widgetId.current);
            callback.current(null);
        },
    }));

    useEffect(() => {
        let cancelled = false;
        loadScript(locale)
            .then(() => {
                if (cancelled || !container.current || widgetId.current !== null) return;
                widgetId.current = window.grecaptcha!.render(container.current, {
                    sitekey: siteKey,
                    callback: (token: string) => callback.current(token),
                    "expired-callback": () => callback.current(null),
                    "error-callback": () => callback.current(null),
                });
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [siteKey, locale]);

    return <div ref={container} style={{ margin: "4px 0 12px", minHeight: 78, maxWidth: "100%", overflow: "hidden" }} />;
});

export default Captcha;
