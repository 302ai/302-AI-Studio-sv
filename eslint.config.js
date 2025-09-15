import js from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import ts from "typescript-eslint";
import svelteConfig from "./svelte.config.js";

export default [
	// JavaScript 基础规则
	js.configs.recommended,

	// Svelte 推荐规则
	...svelte.configs.recommended,

	// 全局配置
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				...globals.es2024,
			},
			ecmaVersion: 2024,
			sourceType: "module",
		},
		rules: {
			// 基本代码质量
			"no-console": "warn",
			"no-debugger": "error",
			"prefer-const": "error",
			"no-var": "error",
			"no-unused-vars": "warn",

			// 基本最佳实践
			eqeqeq: ["warn", "always"],
			"no-eval": "error",
			"no-duplicate-imports": "error",

			// Svelte 特定 (基础)
			"svelte/valid-compile": "error",
			"svelte/no-unused-svelte-ignore": "warn",
		},
	},

	// 忽略文件
	{
		ignores: [
			"node_modules/**",
			".svelte-kit/**",
			"build/**",
			"dist/**",
			"out/**",
			"static/**",
			"src/lib/paraglide/**",
			"*.config.js.timestamp-*",
			"*.config.ts.timestamp-*",
			".vite/**",
			"coverage/**",
			"test-results/**",
		],
	},
	{
		files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: [".svelte"],
				parser: ts.parser,
				svelteConfig,
			},
		},
	},
];
