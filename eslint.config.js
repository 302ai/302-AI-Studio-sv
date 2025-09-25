import { includeIgnoreFile } from "@eslint/compat";
import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";
import svelte from "eslint-plugin-svelte";
import { defineConfig } from "eslint/config";
import globals from "globals";
import { fileURLToPath } from "node:url";
import svelteParser from "svelte-eslint-parser";
import ts from "typescript-eslint";
import svelteConfig from "./svelte.config.js";
const gitignorePath = fileURLToPath(new URL("./.gitignore", import.meta.url));
export default defineConfig([
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	...svelte.configs.prettier,
	prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
		},
		rules: {
			"no-undef": "off",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
		},
	},
	{
		files: ["**/generated/**/*.ts"],
		rules: {
			"@typescript-eslint/no-empty-object-type": [
				"error",
				{
					allowInterfaces: "always",
				},
			],
		},
	},
	{
		files: ["**/*.svelte.ts", "**/*.svelte"],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				projectService: true,
				extraFileExtensions: [".svelte"],
				svelteConfig,
				parser: {
					ts: tsParser,
					typescript: tsParser,
				},
			},
		},
		rules: {
			"svelte/no-navigation-without-resolve": "off",
		},
	},
	{
		files: ["**/*.svelte.ts", "**/*.svelte.js"],
		languageOptions: {
			parserOptions: {
				projectService: true,
				parser: tsParser,
			},
		},
	},
]);
