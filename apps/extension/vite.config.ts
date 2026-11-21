import { defineConfig } from "vite";
import { resolve } from "node:path";

// Multi-entry MV3 build: background service worker + three extension pages.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    modulePreload: false,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background.ts"),
        popup: resolve(__dirname, "popup.html"),
        options: resolve(__dirname, "options.html"),
        thinkfirst: resolve(__dirname, "thinkfirst.html"),
      },
      output: { entryFileNames: "[name].js", chunkFileNames: "chunks/[name]-[hash].js", assetFileNames: "assets/[name][extname]" },
    },
  },
});
