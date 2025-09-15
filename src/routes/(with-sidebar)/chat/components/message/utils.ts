import { m } from "$lib/paraglide/messages";
import type { Locale as ParaglideLocale } from "$lib/paraglide/runtime";
import {
	formatDistanceToNow,
	type FormatDistanceFnOptions,
	type FormatDistanceToken,
	type Locale,
} from "date-fns";
import { enUS, zhCN } from "date-fns/locale";

const localeMap: Record<ParaglideLocale, Locale> = {
	en: enUS,
	zh: zhCN,
};

export function formatTimeAgo(createTime: string, localeCode: ParaglideLocale) {
	const locale = localeMap[localeCode];
	const now = new Date();
	const diff = now.getTime() - new Date(createTime).getTime();
	const seconds = Math.floor(diff / 1000);

	const customLocale = {
		...locale,
		formatDistance: (
			token: FormatDistanceToken,
			count: number,
			options?: FormatDistanceFnOptions,
		) => {
			if (token === "lessThanXMinutes" && count === 1) {
				return m.text_just_now();
			}
			return locale.formatDistance(token, count, options);
		},
	};

	if (seconds < 30) {
		return m.text_just_now();
	}

	return formatDistanceToNow(new Date(createTime), {
		addSuffix: true,
		locale: customLocale,
	});
}
