import { type } from "arktype";

export const TabType = type(
	"'chat' | 'settings' | 'aiApplications' | 'codeAgent' | 'htmlPreview' | 'helpDocs' | 'skillsHub' | 'openClawWebUi'",
);
export type TabType = typeof TabType.infer;

export const TabUIState = type({
	"scrollPosition?": "number",
	"inputValue?": "string",
});
export type TabUIState = typeof TabUIState.infer;

export const Tab = type({
	id: "string",
	title: "string",
	href: "string",
	"incognitoMode?": "boolean",
	type: TabType,
	active: "boolean",
	threadId: "string",
	"content?": "string", // Optional content for special tab types like htmlPreview
	"previewId?": "string", // Optional preview identifier for htmlPreview tabs
	"initialSearchQuery?": "string", // Optional search query to inherit when tab is created
	"initialSearchResultIds?": "string[]", // Optional pre-computed search result thread IDs
	"uiState?": TabUIState,
	"isSleeping?": "boolean",
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
