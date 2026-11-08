const NAMES: Record<string, string> = {
    en: "english",
    es: "spanish",
    fr: "french",
    de: "german",
    it: "italian",
    pt: "portuguese",
    nl: "dutch",
    ru: "russian",
};

const WIKTIONARY_SECTIONS: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    nl: "Dutch",
    ru: "Russian",
};

export function dictionaryLinks(term: string, from: string, to: string) {
    const q = encodeURIComponent(term);
    const links = [
        { name: "Google Translate", url: `https://translate.google.com/?sl=${from}&tl=${to}&text=${q}&op=translate` },
        { name: "Wiktionary", url: `https://en.wiktionary.org/wiki/${encodeURIComponent(term.toLowerCase())}#${WIKTIONARY_SECTIONS[from] ?? ""}` },
    ];

    if (NAMES[from] && NAMES[to] && from !== to) {
        links.push({ name: "Reverso Context", url: `https://context.reverso.net/translation/${NAMES[from]}-${NAMES[to]}/${q}` });
    }
    if ((from === "en" || to === "en") && from !== to) {
        links.push({ name: "WordReference", url: `https://www.wordreference.com/${from}${to}/${q}` });
    }
    return links;
}
