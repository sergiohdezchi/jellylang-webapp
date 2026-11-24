import { useEffect, useRef } from "react";
import { useI18n } from "../../i18n/I18nProvider";

interface GoogleId {
    initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
    renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
}

declare global {
    interface Window {
        google?: { accounts: { id: GoogleId } };
    }
}

interface Props {
    clientId: string;
    /** Recibe el token (ID token) que entrega Google */
    onCredential: (credential: string) => void;
}

let scriptPromise: Promise<void> | null = null;

function loadScript() {
    scriptPromise ??= new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
            scriptPromise = null; // permite reintentar
            reject(new Error("Google no se pudo cargar"));
        };
        document.head.appendChild(script);
    });
    return scriptPromise;
}

/** Botón oficial «Iniciar sesión con Google» (Google Identity Services). */
export default function GoogleButton({ clientId, onCredential }: Props) {
    const { locale } = useI18n();
    const container = useRef<HTMLDivElement>(null);
    const callback = useRef(onCredential);
    callback.current = onCredential;

    useEffect(() => {
        let cancelled = false;
        loadScript()
            .then(() => {
                if (cancelled || !container.current || !window.google) return;
                const id = window.google.accounts.id;
                id.initialize({ client_id: clientId, callback: (response) => callback.current(response.credential) });
                container.current.replaceChildren();
                id.renderButton(container.current, { type: "standard", theme: "outline", size: "large", text: "signin_with", shape: "rectangular", width: 300, locale });
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [clientId, locale]);

    return <div ref={container} />;
}
