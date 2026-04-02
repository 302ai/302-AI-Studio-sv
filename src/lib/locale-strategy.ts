import { defineCustomClientStrategy } from "$lib/paraglide/runtime";
import { createLogger } from "@shared/logger";

const logger = createLogger("ui");

defineCustomClientStrategy("custom-sessionStorage", {
	getLocale: () => {
		const locale = localStorage.getItem("user-locale") ?? "zh";
		// logger.info("[locale-strategy] getLocale:", locale);
		return locale;
	},
	setLocale: (locale) => {
		// logger.info("[locale-strategy] setLocale:", locale);
		localStorage.setItem("user-locale", locale);
	},
});

logger.info("[locale-strategy] Custom strategy registered");
