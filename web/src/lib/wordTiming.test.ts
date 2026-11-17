import { describe, expect, it } from "vitest";
import { exactWordTimes, wordAtChar, wordAtTime } from "./wordTiming";

describe("exactWordTimes", () => {
    const segment = (word_times: (number | null)[] | null) => ({ start: 10, end: 14, word_times });

    it("devuelve los tiempos cuando son completos y crecientes", () => {
        expect(exactWordTimes(segment([10, 10.5, 11.2]), 3)).toEqual([10, 10.5, 11.2]);
    });

    it("no estima: sin tiempos, con huecos o con otro número de palabras devuelve null", () => {
        expect(exactWordTimes(segment(null), 3)).toBeNull();
        expect(exactWordTimes(segment([10, null, 11.2]), 3)).toBeNull();
        expect(exactWordTimes(segment([10, 10.5]), 3)).toBeNull();
    });

    it("rechaza tiempos desordenados o fuera del segmento", () => {
        expect(exactWordTimes(segment([10, 12, 11]), 3)).toBeNull();
        expect(exactWordTimes(segment([10, 11, 20]), 3)).toBeNull();
    });
});

describe("wordAtTime / wordAtChar", () => {
    it("encuentra la palabra activa", () => {
        expect(wordAtTime([1, 2, 3], 0.5)).toBe(-1);
        expect(wordAtTime([1, 2, 3], 2.4)).toBe(1);
        expect(wordAtTime([1, 2, 3], 9)).toBe(2);
    });

    it("traduce posiciones de caracteres a palabras", () => {
        const ranges = [
            { start: 0, end: 5 },
            { start: 6, end: 11 },
        ];
        expect(wordAtChar(ranges, 0)).toBe(0);
        expect(wordAtChar(ranges, 6)).toBe(1);
        expect(wordAtChar(ranges, 5)).toBe(0);
    });
});
