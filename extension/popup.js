import { ApiError, api, ensureHostPermission } from "./lib/api.js";
import { has, locale, t } from "./lib/i18n.js";
import { readSessionToken } from "./lib/session.js";
import { getPrefs, getSettings, saveLanguagePrefs, savePrefs, saveSettings } from "./lib/storage.js";

const $ = (id) => document.getElementById(id);
const VIEWS = ["view-loading", "view-login", "view-unsupported", "view-form", "view-progress", "view-done", "view-error", "view-settings"];
const NEW_COURSE = "__new__";
const YOUTUBE_VIDEO = /^https:\/\/www\.youtube\.com\/(watch\?|shorts\/|live\/)/;

let settings; // { apiUrl, appUrl, token }
let user;
let tabId;
let video; // { videoId, title, author, duration, image }
let tracks = [];

// ---- textos -----------------------------------------------------------------------------------
document.documentElement.lang = locale;
document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
$("open-settings").title = t("settings");
$("open-settings").setAttribute("aria-label", t("settings"));
$("course-new").placeholder = t("newCoursePlaceholder");

// ---- utilidades -------------------------------------------------------------------------------
function show(view) {
    VIEWS.forEach((id) => ($(id).hidden = id !== view));
}

function showError(error) {
    const code = error?.code ?? "unexpected";
    const key = `err.${code}`;
    // Los errores de la API llegan ya traducidos al idioma del usuario
    const message = error instanceof ApiError && code !== "network" ? error.message : has(key) ? t(key, { detail: error?.message ?? "" }) : error?.message || t("err.unexpected");
    $("error-text").textContent = message;
    show("view-error");
}

/** Mensaje al content script de YouTube de la pestaña. */
async function callTab(type, payload) {
    let response;
    try {
        response = await chrome.tabs.sendMessage(tabId, { target: "jellylang-youtube", type, payload });
    } catch {
        // La pestaña se abrió antes de instalar la extensión: no tiene el content script
        throw Object.assign(new Error("reload_page"), { code: "reload_page" });
    }
    if (!response?.ok) throw Object.assign(new Error(response?.error?.message ?? "unexpected"), { code: response?.error?.code ?? "unexpected" });
    return response.result;
}

const fill = (select, options) =>
    select.replaceChildren(
        ...options.map(({ value, label }) => {
            const option = document.createElement("option");
            option.value = String(value);
            option.textContent = label;
            return option;
        }),
    );

const selectedLanguage = () => user.languages.map((entry) => entry.language).find((language) => String(language.id) === $("language").value);

// ---- arranque ---------------------------------------------------------------------------------
async function init() {
    show("view-loading");
    $("user").textContent = "";
    settings = await getSettings();

    // 1. Sesión de la web
    settings.token = await readSessionToken(settings);
    if (!settings.token) return show("view-login");
    try {
        user = await api(settings, "/auth/me");
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) return show("view-login");
        return showError(error);
    }
    $("user").textContent = user.name || user.email;
    if (!user.languages?.length) return showError({ message: t("loginText") });

    // 2. Pestaña: ¿es un video de YouTube? (?tabId= permite probar el popup abierto como pestaña)
    tabId = Number(new URLSearchParams(location.search).get("tabId")) || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
    const tab = tabId ? await chrome.tabs.get(tabId).catch(() => null) : null;
    if (!tab?.url || !YOUTUBE_VIDEO.test(tab.url)) return show("view-unsupported");

    try {
        video = await callTab("GetVideoInfo");
    } catch (error) {
        return showError(error);
    }
    if (video.isLive) return showError({ code: "live_video" });

    // 3. Formulario
    const prefs = await getPrefs();
    $("title").value = video.title;
    $("thumb").src = video.image ?? `https://i.ytimg.com/vi/${encodeURIComponent(video.videoId)}/mqdefault.jpg`;
    $("open-after").checked = prefs.openAfterImport;

    const languages = user.languages.map((entry) => entry.language);
    fill($("language"), languages.map((language) => ({ value: language.id, label: language.name })));
    const preferred = languages.find((language) => language.id === prefs.languageId) ?? user.current_language ?? languages[0];
    $("language").value = String(preferred.id);

    show("view-form");
    await onLanguageChange();
}

/** Al cambiar de idioma: pistas de subtítulos, cursos y nivel recordados para ese idioma. */
async function onLanguageChange() {
    const language = selectedLanguage();
    const button = $("import");
    button.disabled = true;
    await savePrefs({ languageId: language.id });

    try {
        const [result, courses, prefs] = await Promise.all([
            callTab("GetVideoTracks", { language: language.code }),
            api(settings, `/courses?language_id=${language.id}`),
            getPrefs(),
        ]);
        tracks = result.tracks;

        // Subtítulos: selector solo si hay varias pistas; aviso si no hay ninguna
        fill($("tracks"), tracks.map((track) => ({ value: track.tid, label: track.kind === "asr" ? `${track.name} (${t("auto")})` : track.name })));
        $("tracks-field").hidden = tracks.length < 2;
        $("no-tracks").hidden = tracks.length > 0;
        if (!tracks.length) {
            const list = result.available.join(", ");
            $("no-tracks").textContent = [t("noTracks", { language: language.name }), list && t("availablePrefix", { list })].filter(Boolean).join(" ");
        }

        // Curso y nivel recordados
        const remembered = prefs.byLanguage[language.id] ?? {};
        fill($("course"), [
            { value: "", label: t("noCourse") },
            ...courses.map((course) => ({ value: course.id, label: course.title })),
            { value: NEW_COURSE, label: t("newCourse") },
        ]);
        $("course").value = courses.some((course) => course.id === remembered.courseId) ? String(remembered.courseId) : "";
        $("course-new").hidden = true;
        $("level").value = remembered.level ?? "";

        button.disabled = tracks.length === 0;
    } catch (error) {
        showError(error);
    }
}

async function importVideo(event) {
    event.preventDefault();
    const language = selectedLanguage();
    const tid = Number($("tracks").value);
    const courseValue = $("course").value;
    const newCourse = $("course-new").value.trim();
    if (courseValue === NEW_COURSE && !newCourse) return $("course-new").focus();

    show("view-progress");
    try {
        const subtitles = await callTab("GetVideoSubs", { tid });
        const body = {
            source: "youtube",
            language_id: language.id,
            level: $("level").value,
            video: { id: video.videoId, title: $("title").value.trim(), author: video.author, duration: video.duration },
            track: { language: subtitles.language, kind: subtitles.kind, format: subtitles.format, content: subtitles.content },
        };
        if (courseValue === NEW_COURSE) body.course_title = newCourse;
        else body.course_id = courseValue;

        const result = await api(settings, "/imports", { method: "POST", body });
        const lessonUrl = `${settings.appUrl.replace(/\/+$/, "")}/lessons/${result.lesson.id}`;

        await saveLanguagePrefs(language.id, { courseId: result.lesson.course_id, level: $("level").value });
        await savePrefs({ openAfterImport: $("open-after").checked });

        $("done-title").textContent = t(result.created ? "done" : "updated");
        $("open-lesson").onclick = () => chrome.tabs.create({ url: lessonUrl });
        show("view-done");
        if ($("open-after").checked) chrome.tabs.create({ url: lessonUrl });
    } catch (error) {
        showError(error);
    }
}

// ---- eventos ----------------------------------------------------------------------------------
$("view-form").addEventListener("submit", importVideo);
$("language").addEventListener("change", onLanguageChange);
$("course").addEventListener("change", () => {
    const isNew = $("course").value === NEW_COURSE;
    $("course-new").hidden = !isNew;
    if (isNew) $("course-new").focus();
});
$("level").addEventListener("change", () => saveLanguagePrefs(selectedLanguage().id, { level: $("level").value }));
$("open-after").addEventListener("change", () => savePrefs({ openAfterImport: $("open-after").checked }));
$("login-button").addEventListener("click", () => chrome.tabs.create({ url: `${settings.appUrl.replace(/\/+$/, "")}/login` }));
$("error-back").addEventListener("click", init);

$("open-settings").addEventListener("click", async () => {
    const current = await getSettings();
    $("api-url").value = current.apiUrl;
    $("app-url").value = current.appUrl;
    show("view-settings");
});
$("settings-cancel").addEventListener("click", init);
$("view-settings").addEventListener("submit", async (event) => {
    event.preventDefault();
    const apiUrl = $("api-url").value.trim();
    const appUrl = $("app-url").value.trim();
    // Va primero: el permiso solo se puede pedir mientras dura el clic del usuario
    if (!(await ensureHostPermission(apiUrl, appUrl))) return showError({ code: "permission" });
    await saveSettings({ apiUrl, appUrl });
    init();
});

init();
