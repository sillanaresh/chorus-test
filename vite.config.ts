import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { readFileSync } from "node:fs";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// Import and apply polyfills
import { applyPolyfills } from "./src/polyfills";

// @ts-ignore process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
// @ts-ignore process is a nodejs global
const port = process.env.VITE_PORT ? parseInt(process.env.VITE_PORT) : 1420;
// @ts-ignore process is a nodejs global
const hmrPort = process.env.VITE_HMR_PORT
    ? parseInt(process.env.VITE_HMR_PORT)
    : 1421;
const isMobileBuild = process.env.VITE_CHORUS_MOBILE === "1";

const mobileBuildPlugin = {
    name: "chorus-mobile-build",
    transformIndexHtml(html: string) {
        if (!isMobileBuild) return html;
        return html
            .replace(/\s*<script data-desktop-analytics>[\s\S]*?<\/script>/, "")
            .replace(
                /\s*<link rel="icon" type="image\/svg\+xml" href="\/vite\.svg" \/>/,
                "",
            );
    },
    generateBundle(this: { emitFile: (asset: object) => void }) {
        if (!isMobileBuild) return;

        const mobilePublicAssets = [
            "fonts/Geist-VariableFont_wght.ttf",
            "fonts/GeistMono-VariableFont_wght.ttf",
            "openrouter_dark.svg",
        ];

        for (const fileName of mobilePublicAssets) {
            this.emitFile({
                type: "asset",
                fileName,
                source: readFileSync(
                    path.resolve(__dirname, "public", fileName),
                ),
            });
        }
    },
};

// https://vitejs.dev/config/
export default defineConfig(async ({ command }) => ({
    plugins: [
        react(),
        mobileBuildPlugin,
        nodePolyfills({
            include: ["os"],
        }),
    ],
    resolve: {
        alias: [
            ...(isMobileBuild
                ? [
                      {
                          find: /^posthog-js(?:\/react)?$/,
                          replacement: path.resolve(
                              __dirname,
                              "./src/ui/mobilePostHogStub.ts",
                          ),
                      },
                  ]
                : []),
            { find: "path", replacement: "path-browserify" },
            { find: "fs", replacement: "fs" },
            { find: "@ui", replacement: path.resolve(__dirname, "./src/ui") },
            {
                find: "@core",
                replacement: path.resolve(__dirname, "./src/core"),
            },
            { find: "@", replacement: path.resolve(__dirname, "./src") },
        ],
    },
    publicDir: isMobileBuild && command === "build" ? false : "public",
    build: {
        target: ["safari15"], // add chrome105 if we add windows support
    },

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
        port: port,
        strictPort: true,
        host: host || false,
        hmr: host
            ? {
                  protocol: "ws",
                  host,
                  port: hmrPort,
              }
            : undefined,
        watch: {
            // 3. tell vite to ignore watching `src-tauri`
            ignored: ["**/src-tauri/**"],
        },
    },
}));
