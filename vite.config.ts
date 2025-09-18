import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import path from "path";
import { ipcServiceGenerator } from "./vite-plugins/ipc-service-generator";

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		paraglideVitePlugin({
			project: "./project.inlang",
			outdir: "./src/lib/paraglide",
		}),
		ipcServiceGenerator({
			servicesDir: "electron/main/services",
			outputDir: "electron/main/generated",
			formatCommand: "pnpm prettier --write",
		}),
	],
	resolve: {
		alias: {
			"@shared": path.resolve(__dirname, "./electron/shared"),
			"@electron": path.resolve(__dirname, "./electron"),
		},
	},
});
