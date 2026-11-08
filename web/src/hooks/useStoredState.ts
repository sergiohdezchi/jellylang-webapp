import { useEffect, useState } from "react";

/** Preferencia local del usuario (no crítica): si el almacenamiento falla se usa el valor por defecto. */
export function useStoredState<T>(key: string, initial: T) {
    const [value, setValue] = useState<T>(() => {
        try {
            const raw = localStorage.getItem(key);
            return raw === null ? initial : (JSON.parse(raw) as T);
        } catch {
            return initial;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // sin almacenamiento
        }
    }, [key, value]);

    return [value, setValue] as const;
}
