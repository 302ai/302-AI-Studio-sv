import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { Theme, ThemeState } from "@shared/types";
import { untrack } from "svelte";

const getSystemTheme = (): ThemeState => {
	const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	return {
		theme: isDark ? "dark" : "light",
		shouldUseDarkColors: isDark,
	};
};

export const transitionState = $state({
	isTransitioning: false,
});
export const persistedThemeState = new PersistedState("app-theme-state", getSystemTheme());

$effect.root(() => {
	$effect(() => {
		const currentState = persistedThemeState.current;
		window.electronAPI.appService.setTheme(currentState.theme).then(() => {
			untrack(() => {
				if (currentState.shouldUseDarkColors) {
					document.documentElement.classList.add("no-transition", "dark");
					document.documentElement.classList.remove("light");
				} else {
					document.documentElement.classList.add("no-transition", "dark");
					document.documentElement.classList.remove("dark");
				}

				transitionState.isTransitioning = false;

				setTimeout(() => {
					document.documentElement.classList.remove("no-transition");
				}, 1000);
			});
		});
	});
});

export function toggleTheme() {
	setTheme(persistedThemeState.current.shouldUseDarkColors ? "light" : "dark");
}

export function setTheme(theme: Theme) {
	console.log("setTheme");
	transitionState.isTransitioning = true;
	const currentState = persistedThemeState.current;
	persistedThemeState.current = {
		...currentState,
		theme,
		shouldUseDarkColors:
			theme === "system" ? getSystemTheme().shouldUseDarkColors : theme === "dark",
	};
}
