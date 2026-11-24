import { describe, expect, it } from "vitest";
import { isPasswordValid, passwordFailures, passwordStrength } from "./passwordPolicy";

// Mismos casos que api/spec/services/password_policy_spec.rb
describe("passwordPolicy", () => {
    it("acepta contraseñas robustas", () => {
        expect(isPasswordValid("Medusa-Azul-2026", "ana@example.com")).toBe(true);
        expect(isPasswordValid("Árbol.Verde.81")).toBe(true);
    });

    it("explica cada regla que falla", () => {
        expect(passwordFailures("abc")).toEqual(expect.arrayContaining(["length", "uppercase", "digit"]));
        expect(passwordFailures("ABCDEFGHIJ1")).toContain("lowercase");
        expect(passwordFailures("Zzzzz-Rio-2026")).toContain("repeated");
        expect(passwordFailures("MiPassword2026")).toContain("common");
        expect(passwordFailures("SoyAna.Rios2026", "anarios@example.com")).toContain("email");
    });

    it("mide la fuerza", () => {
        expect(passwordStrength("")).toBe(0);
        expect(passwordStrength("abc")).toBe(1);
        expect(passwordStrength("Medusa2026")).toBe(3);
        expect(passwordStrength("Medusa-Azul-2026")).toBe(4);
    });
});
