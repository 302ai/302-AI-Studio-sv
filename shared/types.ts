export type Theme = "light" | "dark" | "system";
export type Platform = "win32" | "darwin" | "linux";

export type SheetWindowConfig = {
	activeTabId?: string;
	anchor?: {
		x: number;
		y: number;
	};
};

export type StorageValue = string | number | boolean | object;
