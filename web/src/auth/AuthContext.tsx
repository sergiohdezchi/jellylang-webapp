import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, getToken, onUnauthorized, setToken } from "../api/client";
import type { Language, User } from "../api/types";

interface AuthResponse {
    token: string;
    user: User;
}

/** Registro pendiente de confirmar con el código enviado por correo */
export interface PendingVerification {
    verification_required: true;
    email: string;
    /** Segundos hasta poder pedir otro código */
    resend_in: number;
}

const isPending = (data: AuthResponse | PendingVerification): data is PendingVerification => "verification_required" in data;

export interface SignupData {
    email: string;
    password: string;
    name?: string;
    native_language: string;
    ui_language: string;
    study_language_id: number;
    captcha_token?: string | null;
}

interface AuthContextValue {
    user: User | null;
    loading: boolean;
    language: Language | null;
    login: (email: string, password: string, captchaToken?: string | null) => Promise<void>;
    /** Entra con el token de Google; crea la cuenta si el correo es nuevo */
    loginWithGoogle: (credential: string, uiLanguage: string) => Promise<void>;
    /** Devuelve el registro pendiente si hay que confirmar el email; null si ya inició sesión */
    signup: (data: SignupData) => Promise<PendingVerification | null>;
    /** Recuperar contraseña, paso 1: envía el código al email (responde igual exista o no la cuenta) */
    forgotPassword: (email: string, captchaToken?: string | null) => Promise<PendingVerification>;
    /** Paso 2: cambia la contraseña con el código e inicia sesión */
    resetPassword: (email: string, code: string, password: string) => Promise<void>;
    verifyEmail: (email: string, password: string, code: string) => Promise<void>;
    resendCode: (email: string, password: string) => Promise<PendingVerification>;
    logout: () => void;
    updateUser: (data: Record<string, unknown>) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(Boolean(getToken()));

    const logout = useCallback(() => {
        // Borra también la cookie de sesión que usa la extensión del navegador (si falla, no importa)
        api("/auth/session", { method: "DELETE" }).catch(() => {});
        setToken(null);
        setUser(null);
        queryClient.clear();
    }, [queryClient]);

    useEffect(() => {
        onUnauthorized(logout);
        if (!getToken()) return;

        api<User>("/auth/me")
            .then(setUser)
            .catch(() => logout())
            .finally(() => setLoading(false));
    }, [logout]);

    const login = useCallback(async (email: string, password: string, captchaToken?: string | null) => {
        const data = await api<AuthResponse>("/auth/login", { method: "POST", body: { email, password, captcha_token: captchaToken } });
        setToken(data.token);
        setUser(data.user);
    }, []);

    const startSession = useCallback((data: AuthResponse) => {
        setToken(data.token);
        setUser(data.user);
    }, []);

    const loginWithGoogle = useCallback(
        async (credential: string, uiLanguage: string) => {
            startSession(await api<AuthResponse>("/auth/google", { method: "POST", body: { credential, ui_language: uiLanguage } }));
        },
        [startSession],
    );

    const signup = useCallback(
        async (payload: SignupData) => {
            const data = await api<AuthResponse | PendingVerification>("/auth/signup", { method: "POST", body: payload });
            if (isPending(data)) return data;
            startSession(data);
            return null;
        },
        [startSession],
    );

    const verifyEmail = useCallback(
        async (email: string, password: string, code: string) => {
            startSession(await api<AuthResponse>("/auth/verify_email", { method: "POST", body: { email, password, code } }));
        },
        [startSession],
    );

    const forgotPassword = useCallback(async (email: string, captchaToken?: string | null) => {
        const data = await api<{ email: string; resend_in: number }>("/auth/forgot_password", {
            method: "POST",
            body: { email, captcha_token: captchaToken },
        });
        return { verification_required: true as const, ...data };
    }, []);

    const resetPassword = useCallback(
        async (email: string, code: string, password: string) => {
            startSession(await api<AuthResponse>("/auth/reset_password", { method: "POST", body: { email, code, password } }));
        },
        [startSession],
    );

    const resendCode = useCallback(
        async (email: string, password: string) => {
            const data = await api<AuthResponse | PendingVerification>("/auth/resend_code", { method: "POST", body: { email, password } });
            if (isPending(data)) return data;
            // Ya estaba verificada (por ejemplo, desde otra pestaña)
            startSession(data);
            return { verification_required: true as const, email, resend_in: 0 };
        },
        [startSession],
    );

    const updateUser = useCallback(
        async (data: Record<string, unknown>) => {
            const updated = await api<User>("/auth/me", { method: "PATCH", body: data });
            setUser(updated);
            if (data.current_language_id) queryClient.invalidateQueries();
            return updated;
        },
        [queryClient],
    );

    const value = useMemo(
        () => ({ user, loading, language: user?.current_language ?? null, login, loginWithGoogle, signup, verifyEmail, resendCode, forgotPassword, resetPassword, logout, updateUser }),
        [user, loading, login, loginWithGoogle, signup, verifyEmail, resendCode, forgotPassword, resetPassword, logout, updateUser],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
    return context;
}

/** Idioma de estudio actual; las páginas protegidas garantizan que existe. */
export function useLanguage(): Language {
    const { language } = useAuth();
    if (!language) throw new Error("No hay idioma de estudio seleccionado");
    return language;
}
