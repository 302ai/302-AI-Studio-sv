declare module "markdown-it-texmath" {
	import type { PluginWithOptions } from "markdown-it";

	interface TexmathOptions {
		engine?: unknown;
		delimiters?: "dollars" | "brackets" | "gitlab" | "kramdown";
		katexOptions?: Record<string, unknown>;
	}

	const texmath: PluginWithOptions<TexmathOptions>;
	export default texmath;
}
