import { createHighlighter, createJavaScriptRegexEngine } from "shiki";
import type { Highlighter as ShikiHighlighter } from "shiki";

const CODE_THEMES = ["vitesse-dark", "vitesse-light"] as const;
const CODE_LANGUAGES = [
	"bash",
	"css",
	"diff",
	"docker",
	"go",
	"graphql",
	"html",
	"javascript",
	"json",
	"markdown",
	"plaintext",
	"python",
	"rust",
	"shell",
	"sql",
	"svelte",
	"tsx",
	"typescript",
	"yaml",
] as const;

let highlighterPromise: Promise<ShikiHighlighter> | null = null;

export const ensureHighlighter = (): Promise<ShikiHighlighter> => {
	if (!highlighterPromise) {
		highlighterPromise = createHighlighter({
			langs: [...new Set(CODE_LANGUAGES)],
			themes: [...new Set(CODE_THEMES)],
			engine: createJavaScriptRegexEngine(),
		});
	}
	return highlighterPromise;
};

export type { ShikiHighlighter };
export const DEFAULT_THEME = CODE_THEMES[0];
