import type { StorageValue } from "@302ai/unstorage";

export * from "@302ai/unstorage";

export interface ThemeState {
	theme: Theme;
	shouldUseDarkColors: boolean;
}

export interface StorageMetadata {
	mtime?: Date;
	atime?: Date;
	size?: number;
}

export interface StorageOptions {
	removeMeta?: boolean;
}

export interface StorageItem<T = StorageValue> {
	key: string;
	value: T;
}

export type Theme = "light" | "dark" | "system";
export type Platform = "win32" | "darwin" | "linux";

export type SheetWindowConfig = {
	activeTabId?: string;
	anchor?: {
		x: number;
		y: number;
	};
};
