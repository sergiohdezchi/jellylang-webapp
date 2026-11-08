// Debe mantenerse sincronizado con api/app/services/text/tokenizer.rb
const WORD = /[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu;
const EDGE_PUNCTUATION = /^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu;

export type Token =
    | { kind: "word"; text: string; term: string; index: number }
    | { kind: "text"; text: string };

export function normalizeTerm(value: string): string {
    return value
        .normalize("NFC")
        .replace(/’/g, "'")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(EDGE_PUNCTUATION, "")
        .trim();
}

/** Divide un texto en palabras (clicables) y separadores. */
export function tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    let last = 0;
    let index = 0;

    for (const match of text.matchAll(WORD)) {
        const start = match.index ?? 0;
        if (start > last) tokens.push({ kind: "text", text: text.slice(last, start) });
        tokens.push({ kind: "word", text: match[0], term: normalizeTerm(match[0]), index: index++ });
        last = start + match[0].length;
    }

    if (last < text.length) tokens.push({ kind: "text", text: text.slice(last) });
    return tokens;
}

export function wordTerms(text: string): string[] {
    return Array.from(text.matchAll(WORD), (m) => normalizeTerm(m[0]));
}

/**
 * Busca frases guardadas dentro de una lista de palabras.
 * Devuelve un mapa índice de palabra -> frase.
 */
export function markPhrases<T extends { term: string }>(terms: string[], phrases: T[]): Map<number, T> {
    const marks = new Map<number, T>();

    for (const phrase of phrases) {
        const parts = phrase.term.split(" ");
        if (parts.length < 2) continue;

        for (let i = 0; i <= terms.length - parts.length; i++) {
            if (parts.every((part, j) => terms[i + j] === part)) {
                for (let j = 0; j < parts.length; j++) {
                    if (!marks.has(i + j)) marks.set(i + j, phrase);
                }
            }
        }
    }

    return marks;
}
