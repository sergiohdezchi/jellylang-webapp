import { describe, expect, it } from "vitest";
import { markPhrases, normalizeTerm, tokenize, wordTerms } from "./tokenize";

describe("tokenize", () => {
    it("separa palabras y puntuación", () => {
        const tokens = tokenize("It's a well-known café, isn't it? 42");
        const words = tokens.filter((t) => t.kind === "word").map((t) => t.text);
        expect(words).toEqual(["It's", "a", "well-known", "café", "isn't", "it"]);
        expect(tokens.map((t) => t.text).join("")).toBe("It's a well-known café, isn't it? 42");
    });

    it("normaliza igual que el backend", () => {
        expect(normalizeTerm("  Don’t! ")).toBe("don't");
        expect(normalizeTerm("«Hola   Mundo»")).toBe("hola mundo");
    });

    it("marca frases guardadas", () => {
        const terms = wordTerms("I want to give up now, not give in");
        const marks = markPhrases(terms, [{ term: "give up" }, { term: "give in" }]);
        expect([...marks.keys()]).toEqual([3, 4, 7, 8]);
    });
});
