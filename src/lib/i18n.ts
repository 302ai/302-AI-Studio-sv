import { setLocale } from "$lib/paraglide/runtime";

export function applyLocale(lang: "zh" | "en") {
	setLocale(lang, { reload: true });
}
