/* eslint-disable @typescript-eslint/no-explicit-any */

import type { StorageValue } from "@302ai/unstorage";

export * from "@302ai/unstorage";
export * from "./storage/ai-applications";
export * from "./storage/provider";
export * from "./storage/tab";
export * from "./storage/theme";
export * from "./storage/thread";
export * from "./types/shortcut";

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

export interface MigrationConfig<T extends StorageValue = StorageValue> {
	version: number;
	migrate: (persistedState: any, currentVersion: number) => T;
	debug?: boolean;
}

export interface VersionedStorageValue {
	_version?: number;
}

export type ModelType = "language" | "image-generation" | "tts" | "embedding" | "rerank";

export type ModelCapability = string;

export interface Model {
	id: string;
	name: string;
	remark: string;
	providerId: string;
	capabilities: Set<ModelCapability>;
	type: ModelType;
	custom: boolean;
	enabled: boolean;
	collected: boolean;
}

export interface ModelCreateInput {
	id: string;
	name: string;
	remark?: string;
	providerId: string;
	capabilities?: Set<ModelCapability>;
	type?: ModelType;
	custom?: boolean;
	enabled?: boolean;
	collected?: boolean;
}

export interface ModelUpdateInput {
	id?: string;
	name?: string;
	remark?: string;
	providerId?: string;
	capabilities?: Set<ModelCapability>;
	type?: ModelType;
	custom?: boolean;
	enabled?: boolean;
	collected?: boolean;
}

export interface MCPServer {
	id: string;
}

export interface AttachmentFile {
	id: string;
	name: string;
	type: string;
	size: number;
	file: File;
	preview?: string;
	filePath: string;
}

export interface ThreadParmas {
	id: string;
	title: string;
	temperature: number | null;
	topP: number | null;
	frequencyPenalty: number | null;
	presencePenalty: number | null;
	maxTokens: number | null;
	inputValue: string;
	attachments: AttachmentFile[];
	mcpServers: MCPServer[];
	isThinkingActive: boolean;
	isOnlineSearchActive: boolean;
	isMCPActive: boolean;
	selectedModel: Model | null;
	isPrivateChatActive: boolean;
	updatedAt: Date;
}

export interface ThreadData {
	threadId: string;
	thread: ThreadParmas;
	isFavorite: boolean;
}

// Broadcast system types
export type BroadcastEvent = "thread-list-updated" | "theme-changed" | "settings-updated";

export interface BroadcastEventData {
	broadcastEvent: BroadcastEvent;
	data?: unknown;
	sourceWebContentsId?: number;
}

export interface ShellWindowFullscreenChange {
	windowId: number;
	isFullScreen: boolean;
}
