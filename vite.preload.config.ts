import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  build: {
    outDir: ".vite/build",
    lib: {
      formats: ["es"],
      entry: "electron/preload.ts",
      fileName: "preload",
    },
  },
});
