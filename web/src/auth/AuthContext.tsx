import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, getToken, onUnauthorized, setToken } from "../api/client";
import type { Language, User } from "../api/types";

interface AuthResponse {
    token: string;
    user: User;
}

export interface SignupData {
    email: string;
    password: string;
    name?: string;
    native_language: string;
    ui_language: string;
    study_language_id: number;
}

interface AuthContextValue {
    user: User | null;
    loading: boolean;
    language: Language | null;
    login: (email: string, password: string) => Promise<void>;
    signup: (data: SignupData) => Promise<void>;
    logout: () => void;
    updateUser: (data: Record<string, unknown>) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(Boolean(getToken()));

    const logout = useCallback(() => {
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

    const login = useCallback(async (email: string, password: string) => {
        const data = await api<AuthResponse>("/auth/login", { method: "POST", body: { email, password } });
        setToken(data.token);
        setUser(data.user);
    }, []);

    const signup = useCallback(async (payload: SignupData) => {
        const data = await api<AuthResponse>("/auth/signup", { method: "POST", body: payload });
        setToken(data.token);
        setUser(data.user);
    }, []);

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
        () => ({ user, loading, language: user?.current_language ?? null, login, signup, logout, updateUser }),
        [user, loading, login, signup, logout, updateUser],
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
