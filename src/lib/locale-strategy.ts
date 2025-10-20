import { defineCustomClientStrategy } from "$lib/paraglide/runtime";

defineCustomClientStrategy("custom-sessionStorage", {
	getLocale: () => {
		const locale = localStorage.getItem("user-locale") ?? "zh";
		console.log("[locale-strategy] getLocale:", locale);
		return locale;
	},
	setLocale: (locale) => {
		console.log("[locale-strategy] setLocale:", locale);
		localStorage.setItem("user-locale", locale);
	},
});

console.log("[locale-strategy] Custom strategy registered");
