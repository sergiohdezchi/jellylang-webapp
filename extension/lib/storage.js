// Ajustes y preferencias en chrome.storage.local. Nunca se guardan contraseñas ni el token.
export const DEFAULTS = { apiUrl: "http://localhost:3000", appUrl: "http://localhost:5173" };

export async function getSettings() {
    const stored = await chrome.storage.local.get(["apiUrl", "appUrl"]);
    return { ...DEFAULTS, ...stored };
}

export const saveSettings = (settings) => chrome.storage.local.set(settings);

// Preferencias del formulario: último idioma, "abrir al terminar"
// y, por idioma, el último curso y nivel elegidos.
export async function getPrefs() {
    const { prefs } = await chrome.storage.local.get("prefs");
    return { languageId: null, openAfterImport: true, byLanguage: {}, ...prefs };
}

export async function savePrefs(patch) {
    const prefs = await getPrefs();
    await chrome.storage.local.set({ prefs: { ...prefs, ...patch } });
}

export async function saveLanguagePrefs(languageId, patch) {
    const prefs = await getPrefs();
    const current = prefs.byLanguage[languageId] ?? {};
    await savePrefs({ byLanguage: { ...prefs.byLanguage, [languageId]: { ...current, ...patch } } });
}
