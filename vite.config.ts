import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import path from "node:path";

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
].join("; ");

/** Inject a strict Content-Security-Policy into production HTML only. */
function contentSecurityPolicy(): Plugin {
  return {
    name: "macsweep-csp",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: CSP },
        injectTo: "head-prepend",
      },
    ],
  };
}

export default defineConfig(({ mode }) => {
  // `npm run dev:web` runs the UI in a regular browser with mock data.
  const isWeb = mode === "web";

  return {
    plugins: [
      react(),
      contentSecurityPolicy(),
      ...(isWeb
        ? []
        : [
            electron([
              { entry: "electron/main.ts" },
              {
                entry: "electron/preload.ts",
                onstart(options) {
                  options.reload();
                },
              },
              {
                entry: "electron/tray-preload.ts",
                onstart(options) {
                  options.reload();
                },
              },
            ]),
            renderer(),
          ]),
    ],
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, "index.html"),
          tray: path.resolve(__dirname, "tray.html"),
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
