import { m } from "$lib/paraglide/messages";
import type { Locale as ParaglideLocale } from "$lib/paraglide/runtime";
import type { ChatMessage } from "$lib/types/chat";
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

/**
 * Extract content from assistant message, including both reasoning and text parts
 * @param message - The assistant chat message
 * @returns Formatted content with reasoning wrapped in <thinking> tags
 */
export function getAssistantMessageContent(message: ChatMessage): string {
	const textParts = message.parts.filter((part) => part.type === "text");
	const reasoningParts = message.parts.filter((part) => part.type === "reasoning");

	const textContent = textParts.map((part) => part.text).join("");
	const reasoningContent = reasoningParts
		.map((part) => `<thinking>\n${part.text}\n</thinking>`)
		.join("\n");

	if (reasoningContent && textContent) {
		return `${reasoningContent}\n\n${textContent}`;
	} else if (textContent) {
		return textContent;
	} else if (reasoningContent) {
		return reasoningContent;
	}
	return "";
}
