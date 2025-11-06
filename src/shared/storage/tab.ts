import { type } from "arktype";

export const TabType = type("'chat' | 'settings' | 'aiApplications'");
export type TabType = typeof TabType.infer;

export const Tab = type({
	id: "string",
	title: "string",
	href: "string",
	"incognitoMode?": "boolean",
	type: TabType,
	active: "boolean",
	threadId: "string",
});
export type Tab = typeof Tab.infer;

export const WindowTabs = type({
	tabs: Tab.array(),
});
export type WindowTabs = typeof WindowTabs.infer;

export const TabState = type({
	"[string]": WindowTabs,
});
export type TabState = typeof TabState.infer;

export interface InsertTarget {
	windowId: string;
	insertIndex: number;
}
