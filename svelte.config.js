import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: ".vite/renderer/main_window",
			fallback: "index.html",
		}),
		alias: {
			$lib: "src/lib",
			"$lib/*": "src/lib/*",
			"@shared": "src/shared",
			"@shared/*": "src/shared/*",
			"@electron": "electron",
			"@electron/*": "electron/*",
		},
	},
};

export default config;
