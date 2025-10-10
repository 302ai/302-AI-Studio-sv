import { type } from "arktype";

export const Theme = type("'light' | 'dark' | 'system'");
export type Theme = typeof Theme.infer;

export const ThemeState = type({
	theme: Theme,
	shouldUseDarkColors: "boolean",
});

export type ThemeState = typeof ThemeState.infer;
