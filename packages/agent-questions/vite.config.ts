import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    copyPublicDir: false,
    emptyOutDir: false,
    // Preserve the exact question reveal cue for the public asset map and any
    // host bundler that chooses to emit imported audio as a file.
    assetsInlineLimit: 0,
    lib: {
      entry: {
        index: resolve(import.meta.dirname, "src/index.ts"),
        schema: resolve(import.meta.dirname, "src/schema.ts"),
      },
      formats: ["es", "cjs"],
      fileName: (format, entryName) => `${entryName}.${format === "es" ? "js" : "cjs"}`,
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "@muzluk/mood-wheel",
        "zod",
      ],
      output: {
        assetFileNames: (asset) =>
          asset.names?.some((name) => name.endsWith(".css"))
            ? "agent-questions.css"
            : "assets/[name]-[hash][extname]",
      },
    },
  },
});
