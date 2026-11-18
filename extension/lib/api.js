export class ApiError extends Error {
    constructor(message, status, code) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

const apiBase = (apiUrl) => `${apiUrl.replace(/\/+$/, "")}/api/v1`;

export async function api({ apiUrl, token }, path, { method = "GET", body } = {}) {
    const headers = { Accept: "application/json", "X-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    let response;
    try {
        response = await fetch(apiBase(apiUrl) + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
        throw new ApiError("network", 0, "network");
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(data.error ?? response.statusText, response.status, data.code);
    return data;
}

/** Permiso para hablar con un servidor que no sea localhost. Debe pedirse durante un clic del usuario. */
export async function ensureHostPermission(...urls) {
    const origins = urls.map((url) => `${new URL(url).origin}/*`);
    if (await chrome.permissions.contains({ origins })) return true;
    return chrome.permissions.request({ origins });
}
