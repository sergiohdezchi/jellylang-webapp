/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En Docker, el proxy apunta al contenedor "api"; fuera de Docker, a localhost.
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:3000";

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            "/api": { target: apiTarget },
        },
        watch: {
            // Necesario para detectar cambios a través del volumen de Docker en algunos sistemas
            usePolling: process.env.CHOKIDAR_USEPOLLING === "true",
        },
    },
    test: {
        environment: "jsdom",
        include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    },
});
