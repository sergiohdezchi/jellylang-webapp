// Reglas de contraseña. Son las mismas que valida la API en api/app/services/password_policy.rb:
// si cambias una, cambia la otra.

export const PASSWORD_MIN_LENGTH = 10;

const COMMON = [
    "password", "passw0rd", "contrasena", "contraseña", "qwerty", "asdfgh", "zxcvbn", "azerty", "123456", "654321",
    "abcdef", "abc123", "letmein", "welcome", "bienvenido", "iloveyou", "teamo", "admin", "administrador", "usuario",
    "jellylang", "lingq", "monkey", "dragon", "football", "futbol", "sunshine", "princess", "master", "superman", "batman",
];

/** Reglas que siempre se muestran, y las que solo aparecen cuando se incumplen */
export const BASIC_RULES = ["length", "lowercase", "uppercase", "digit"] as const;
export const EXTRA_RULES = ["repeated", "common", "email"] as const;
export type PasswordRule = (typeof BASIC_RULES)[number] | (typeof EXTRA_RULES)[number];

const compact = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** true = la regla se cumple */
export function checkPassword(password: string, email = ""): Record<PasswordRule, boolean> {
    const normalized = password.toLowerCase();
    const local = compact(email.split("@")[0] ?? "");
    return {
        length: password.length >= PASSWORD_MIN_LENGTH,
        lowercase: /\p{Ll}/u.test(password),
        uppercase: /\p{Lu}/u.test(password),
        digit: /\d/.test(password),
        repeated: !/(.)\1{3,}/u.test(password),
        common: !COMMON.some((word) => normalized.includes(word)),
        email: local.length < 4 || !compact(password).includes(local),
    };
}

export function passwordFailures(password: string, email = ""): PasswordRule[] {
    const result = checkPassword(password, email);
    return (Object.keys(result) as PasswordRule[]).filter((rule) => !result[rule]);
}

export const isPasswordValid = (password: string, email = "") => passwordFailures(password, email).length === 0;

/** 0 = vacía, 1 = débil, 2 = aceptable, 3 = buena, 4 = fuerte. Solo es buena (3+) si cumple todas las reglas. */
export function passwordStrength(password: string, email = ""): 0 | 1 | 2 | 3 | 4 {
    if (!password) return 0;
    const passed = Object.values(checkPassword(password, email)).filter(Boolean).length;
    if (!isPasswordValid(password, email)) return passed >= 6 ? 2 : 1;
    const symbol = /[^\p{L}\p{N}]/u.test(password);
    return password.length >= 14 || (symbol && password.length >= 12) ? 4 : 3;
}
