import { type } from "arktype";

export const TabType = type("'chat' | 'settings' | '302ai-tool'");
export type TabType = typeof TabType.infer;

export const Tab = type({
	id: "string",
	title: "string",
	href: "string",
	"incognitoMode?": "boolean",
	type: TabType,
	active: "boolean",
});
export type Tab = typeof Tab.infer;

export const TabState = Tab.array().array();
export type TabState = typeof TabState.infer;
