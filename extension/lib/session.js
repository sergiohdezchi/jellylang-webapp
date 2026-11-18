// La extensión no tiene inicio de sesión propio: usa la sesión de la web de LinguaQ.
// Al entrar en la web, la API deja el token en la cookie "linguaq_token" (HttpOnly); aquí se lee con
// el permiso "cookies" y se envía a la API como "Authorization: Bearer". Al salir de la web, la cookie se borra.
export const SESSION_COOKIE = "linguaq_token";

export async function readSessionToken({ appUrl, apiUrl }) {
    for (const url of [appUrl, apiUrl]) {
        try {
            const cookie = await chrome.cookies.get({ url, name: SESSION_COOKIE });
            if (cookie?.value) return cookie.value;
        } catch {
            // sin permiso sobre ese origen
        }
    }
    return null;
}
