export type LayoutMode = "default" | "wide" | "ultra-wide";
export type LanguageCode = "zh" | "en";

export interface GeneralSettingsState {
	layoutMode: LayoutMode;
	language: LanguageCode;
	privacyAutoInherit: boolean;
	autoUpdate: boolean;
}
