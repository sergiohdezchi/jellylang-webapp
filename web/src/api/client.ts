const BASE_URL: string = import.meta.env.VITE_API_URL ?? "/api/v1";
const TOKEN_KEY = "jellylang.token";

let token: string | null = readToken();
let unauthorizedHandler: (() => void) | null = null;

export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public details?: Record<string, string[]>,
        /** Código de error estable de la API (p. ej. "email_not_verified") */
        public code?: string,
        /** Respuesta completa, para los datos extra de algunos errores */
        public data: Record<string, unknown> = {},
    ) {
        super(message);
    }
}

function readToken(): string | null {
    try {
        return localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

export function getToken() {
    return token;
}

export function setToken(value: string | null) {
    token = value;
    try {
        if (value) localStorage.setItem(TOKEN_KEY, value);
        else localStorage.removeItem(TOKEN_KEY);
    } catch {
        // almacenamiento no disponible (modo privado): el token vive solo en memoria
    }
}

export function onUnauthorized(handler: () => void) {
    unauthorizedHandler = handler;
}

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    query?: Query;
}

function buildUrl(path: string, query?: Query) {
    const url = new URL(BASE_URL + path, window.location.origin);
    Object.entries(query ?? {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    });
    return url.toString();
}

async function request(path: string, { method = "GET", body, query }: RequestOptions = {}) {
    const headers: Record<string, string> = {
        Accept: "application/json",
        "X-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    let payload: BodyInit | undefined;
    if (body instanceof FormData) {
        payload = body;
    } else if (body !== undefined) {
        headers["Content-Type"] = "application/json";
        payload = JSON.stringify(body);
    }

    const response = await fetch(buildUrl(path, query), { method, headers, body: payload });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 401 && token) unauthorizedHandler?.();
        throw new ApiError(data.error ?? response.statusText, response.status, data.details, data.code, data);
    }

    return response;
}

export async function api<T>(path: string, options?: RequestOptions): Promise<T> {
    const response = await request(path, options);
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
}

/** Descarga un archivo autenticado (exportaciones). */
export async function download(path: string, query?: Query) {
    const response = await request(path, { query });
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? "export.txt";
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}
