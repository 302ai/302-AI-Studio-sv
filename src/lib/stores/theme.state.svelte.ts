import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { Theme, ThemeState } from "@shared/types";
import { setMode } from "mode-watcher";
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
export const persistedThemeState = new PersistedState("ThemeStorage:state", getSystemTheme());

$effect.root(() => {
	$effect(() => {
		const currentState = persistedThemeState.current;
		window.electronAPI.appService.setTheme(currentState.theme).then(() => {
			untrack(() => {
				// Use mode-watcher's setMode to ensure consistent theme management across all windows
				setMode(currentState.theme);
				transitionState.isTransitioning = false;
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
