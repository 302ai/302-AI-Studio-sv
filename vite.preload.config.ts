import { defineConfig } from "vite";
import path from "path";

// https://vitejs.dev/config
export default defineConfig({
	resolve: {
		alias: {
			"@shared": path.resolve(__dirname, "./shared"),
			"@electron": path.resolve(__dirname, "./electron"),
		},
	},
	build: {
		outDir: ".vite/build/preload",
		lib: {
			formats: ["cjs"],
			entry: "electron/preload/index.ts",
			fileName: "index",
		},
		rollupOptions: {
			external: ["electron"],
		},
	},
});
