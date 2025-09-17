import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
	build: {
		outDir: ".vite/build/preload",
		lib: {
			formats: ["es"],
			entry: "electron/preload/index.ts",
			fileName: "index",
		},
	},
});
