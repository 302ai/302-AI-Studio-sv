import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { applyRawUserCss } from "$lib/theme/user-theme";

export const themeCssState = new PersistedState<string>("ThemeCssStorage:raw", "");

function applyThemeCss() {
	applyRawUserCss(themeCssState.current);
}

$effect.root(() => {
	$effect(() => {
		if (themeCssState.isHydrated) {
			applyThemeCss();
		}
	});
});

export function setThemeCss(css: string) {
	if (themeCssState.current !== css) {
		themeCssState.current = css;
	}
}

export function resetThemeCss() {
	themeCssState.current = "";
}

export function getThemeCss(): string {
	return themeCssState.current;
}
