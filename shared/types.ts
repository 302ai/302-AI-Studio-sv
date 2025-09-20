/* eslint-disable @typescript-eslint/no-explicit-any */

import type { StorageValue } from "@302ai/unstorage";

export * from "@302ai/unstorage";
export * from "./storage/theme";

export interface StorageMetadata {
	mtime?: Date;
	atime?: Date;
	size?: number;
}

export interface StorageOptions {
	removeMeta?: boolean;
}

export interface StorageItem<T extends StorageValue> {
	key: string;
	value: T;
}

export type Platform = "win32" | "darwin" | "linux";

export type SheetWindowConfig = {
	activeTabId?: string;
	anchor?: {
		x: number;
		y: number;
	};
};

export type TabType = "chat" | "settings" | "302ai-tool";
export type Tab = {
	id: string;
	title: string;
	href: string;
	incognitoMode?: boolean;
	type: TabType;
};

export interface MigrationConfig<T extends StorageValue = StorageValue> {
	version: number;
	migrate: (persistedState: any, currentVersion: number) => T;
	debug?: boolean;
}

export interface VersionedStorageValue {
	_version?: number;
}
