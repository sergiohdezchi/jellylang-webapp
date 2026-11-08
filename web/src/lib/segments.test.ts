import { describe, expect, it } from "vitest";
import { findActiveSegment, findLastStarted, paginate } from "./segments";

const segments = [
    { start: 0, end: 2 },
    { start: 2, end: 5 },
    { start: 6, end: 9 },
];

describe("findActiveSegment", () => {
    it("encuentra el segmento que contiene el tiempo", () => {
        expect(findActiveSegment(segments, 0)).toBe(0);
        expect(findActiveSegment(segments, 2)).toBe(1);
        expect(findActiveSegment(segments, 8.9)).toBe(2);
    });

    it("devuelve -1 en huecos y fuera de rango", () => {
        expect(findActiveSegment(segments, 5.5)).toBe(-1);
        expect(findActiveSegment(segments, 10)).toBe(-1);
        expect(findActiveSegment([], 1)).toBe(-1);
    });

    it("findLastStarted mantiene el último segmento en los huecos", () => {
        expect(findLastStarted(segments, 5.5)).toBe(1);
        expect(findLastStarted(segments, -1)).toBe(-1);
        expect(findLastStarted(segments, 100)).toBe(2);
    });
});

describe("paginate", () => {
    it("agrupa sin partir elementos", () => {
        const pages = paginate([100, 100, 50, 300, 10], (n) => n, 220);
        expect(pages).toEqual([[100, 100], [50], [300], [10]]);
    });
});
