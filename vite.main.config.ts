import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  build: {
    lib: {
      formats: ["es"],
      entry: "electron/main.ts",
      fileName: "main",
    },
  },
});
