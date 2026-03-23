import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import path from "path";
import { defineConfig } from "vite";
import { ipcServiceGenerator } from "./vite-plugins/ipc-service-generator";

const packageJson = JSON.parse(
	readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
) as { version?: string };

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(packageJson.version ?? "0.0.0"),
	},
	server: {
		watch: {
			// 忽略整个 ai302 目录，避免 tsconfig 变更触发全量 reload
			ignored: ["**/ai302/**"],
		},
	},
	plugins: [
		tailwindcss(),
		sveltekit(),
		paraglideVitePlugin({
			project: "./project.inlang",
			outdir: "./src/lib/paraglide",
			strategy: ["custom-sessionStorage"],
		}),
		ipcServiceGenerator({
			servicesDir: "electron/main/services",
			outputDir: "electron/main/generated",
			formatCommand: "pnpm prettier --write",
		}),
	],
	resolve: {
		alias: {
			"@shared": path.resolve(__dirname, "./src/shared"),
			"@electron": path.resolve(__dirname, "./electron"),
		},
	},
});
