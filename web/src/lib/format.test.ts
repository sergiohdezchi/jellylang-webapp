import { describe, expect, it } from "vitest";
import { formatClock, formatInterval } from "./format";

describe("format", () => {
    it("formatClock", () => {
        expect(formatClock(65)).toBe("1:05");
        expect(formatClock(3725)).toBe("1:02:05");
    });

    it("formatInterval", () => {
        expect(formatInterval(600)).toBe("10m");
        expect(formatInterval(86400 * 3)).toBe("3d");
        expect(formatInterval(86400 * 45)).toBe("1.5mo");
    });
});
