import type { Highlighter as ShikiHighlighter } from "shiki";
import { createHighlighter, createJavaScriptRegexEngine } from "shiki";

const CODE_THEMES = ["vitesse-dark", "vitesse-light"] as const;
export const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
	svg: "xml",
};
// 核心语言：立即加载（最常用的，控制在 30 个以内）
const CORE_LANGUAGES = [
	"plaintext",
	"javascript",
	"typescript",
	"jsx",
	"tsx",
	"python",
	"java",
	"cpp",
	"c",
	"csharp",
	"go",
	"rust",
	"ruby",
	"php",
	"swift",
	"kotlin",
	"dart",
	"sql",
	"html",
	"css",
	"scss",
	"sass",
	"less",
	"json",
	"yaml",
	"xml",
	"bash",
	"shellscript",
	"markdown",
	"latex",
] as const;

// 所有支持的语言（用于按需加载）
const ALL_LANGUAGES = [
	"abap",
	"actionscript-3",
	"ada",
	"angular-html",
	"angular-ts",
	"apache",
	"apex",
	"apl",
	"applescript",
	"ara",
	"asciidoc",
	"asm",
	"astro",
	"awk",
	"ballerina",
	"bat",
	"beancount",
	"berry",
	"bibtex",
	"bicep",
	"blade",
	"bsl",
	"c",
	"cadence",
	"cairo",
	"clarity",
	"clojure",
	"cmake",
	"cobol",
	"codeowners",
	"codeql",
	"coffee",
	"common-lisp",
	"coq",
	"cpp",
	"crystal",
	"csharp",
	"css",
	"csv",
	"cue",
	"cypher",
	"d",
	"dart",
	"dax",
	"desktop",
	"diff",
	"docker",
	"dotenv",
	"dream-maker",
	"edge",
	"elixir",
	"elm",
	"emacs-lisp",
	"erb",
	"erlang",
	"fennel",
	"fish",
	"fluent",
	"fortran-fixed-form",
	"fortran-free-form",
	"fsharp",
	"gdresource",
	"gdscript",
	"gdshader",
	"genie",
	"gherkin",
	"git-commit",
	"git-rebase",
	"gleam",
	"glimmer-js",
	"glimmer-ts",
	"glsl",
	"gnuplot",
	"go",
	"graphql",
	"groovy",
	"hack",
	"haml",
	"handlebars",
	"haskell",
	"haxe",
	"hcl",
	"hjson",
	"hlsl",
	"html",
	"html-derivative",
	"http",
	"hxml",
	"hy",
	"imba",
	"ini",
	"java",
	"javascript",
	"jinja",
	"jison",
	"json",
	"json5",
	"jsonc",
	"jsonl",
	"jsonnet",
	"jssm",
	"jsx",
	"julia",
	"kotlin",
	"kusto",
	"latex",
	"lean",
	"less",
	"liquid",
	"llvm",
	"log",
	"logo",
	"lua",
	"luau",
	"make",
	"markdown",
	"marko",
	"matlab",
	"mdc",
	"mdx",
	"mermaid",
	"mipsasm",
	"mojo",
	"move",
	"narrat",
	"nextflow",
	"nginx",
	"nim",
	"nix",
	"nushell",
	"objective-c",
	"objective-cpp",
	"ocaml",
	"pascal",
	"perl",
	"php",
	"plaintext",
	"plsql",
	"po",
	"polar",
	"postcss",
	"powerquery",
	"powershell",
	"prisma",
	"prolog",
	"proto",
	"pug",
	"puppet",
	"purescript",
	"python",
	"qml",
	"qmldir",
	"qss",
	"r",
	"racket",
	"raku",
	"razor",
	"reg",
	"regexp",
	"rel",
	"riscv",
	"rst",
	"ruby",
	"rust",
	"sas",
	"sass",
	"scala",
	"scheme",
	"scss",
	"sdbl",
	"shaderlab",
	"shellscript",
	"shellsession",
	"smalltalk",
	"solidity",
	"soy",
	"sparql",
	"splunk",
	"sql",
	"ssh-config",
	"stata",
	"stylus",
	"svelte",
	"swift",
	"system-verilog",
	"systemd",
	"talonscript",
	"tasl",
	"tcl",
	"templ",
	"terraform",
	"tex",
	"toml",
	"ts-tags",
	"tsv",
	"tsx",
	"turtle",
	"twig",
	"typescript",
	"typespec",
	"typst",
	"v",
	"vala",
	"vb",
	"verilog",
	"vhdl",
	"viml",
	"vue",
	"vue-html",
	"vue-vine",
	"vyper",
	"wasm",
	"wenyan",
	"wgsl",
	"wikitext",
	"wit",
	"wolfram",
	"xml",
	"xsl",
	"yaml",
	"zenscript",
	"zig",
] as const;

type SupportedLanguage = (typeof ALL_LANGUAGES)[number];

let highlighterPromise: Promise<ShikiHighlighter> | null = null;
const loadedLanguages = new Set<string>(CORE_LANGUAGES);
const loadingQueue: Set<string> = new Set();

/**
 * 确保 highlighter 已初始化并加载必要的语言
 * - 首次加载时，只加载核心语言（快速启动）
 * - 检测到新语言时，自动后台加载
 */
export const ensureHighlighter = (): Promise<ShikiHighlighter> => {
	if (!highlighterPromise) {
		highlighterPromise = createHighlighter({
			langs: [...new Set(CORE_LANGUAGES)],
			themes: [...new Set(CODE_THEMES)],
			engine: createJavaScriptRegexEngine(),
		});
	}
	return highlighterPromise;
};

/**
 * 加载特定语言（如果还未加载）
 * 使用 async/await，但不阻塞 UI，因为在后台执行
 */
export const ensureLanguageLoaded = async (lang: string): Promise<void> => {
	let normalized = (lang || "plaintext").toLowerCase() as SupportedLanguage;

	if (LANGUAGE_ALIASES[normalized]) {
		normalized = LANGUAGE_ALIASES[normalized];
	}

	// 已加载或正在加载，直接返回
	if (loadedLanguages.has(normalized)) {
		return;
	}

	if (loadingQueue.has(normalized)) {
		return;
	}

	// 不在支持列表中，回退到纯文本
	if (!ALL_LANGUAGES.includes(normalized)) {
		console.warn(`Language ${normalized} is not supported, falling back to plaintext`);
		return;
	}

	try {
		loadingQueue.add(normalized);
		const highlighter = await ensureHighlighter();
		await highlighter.loadLanguage(normalized);
		loadedLanguages.add(normalized);
	} catch (error) {
		console.warn(`Failed to load language: ${normalized}`, error);
	} finally {
		loadingQueue.delete(normalized);
	}
};

export type { ShikiHighlighter };
export const DEFAULT_THEME = CODE_THEMES[0];
