import type { SandboxFileInfo } from "$lib/api/sandbox-file";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";
import { createLogger } from "@shared/logger";
import type { CodeAgentType } from "@shared/storage/code-agent";
import { SvelteDate, SvelteSet } from "svelte/reactivity";
import { codeAgentState } from "./code-agent";

const logger = createLogger("state");

/**
 * Get threadId from window.tab or default to "shell"
 */
function getThreadId(): string {
	const tab = window.tab;
	if (tab && typeof tab === "object" && "threadId" in tab && typeof tab.threadId === "string") {
		return tab.threadId;
	}
	return "shell";
}

export type HtmlPreviewMode = "preview" | "edit";

export interface FileContentCache {
	content: string;
	modifiedTime?: string; // File's modified_time when cached
	cachedAt: string; // When the content was cached
	ttl?: number; // Time to live in milliseconds
}

export interface TerminalHistoryLine {
	type: "command" | "output" | "error";
	content: string;
	cwd?: string;
}

export interface AgentPreviewStorage {
	fileList: SandboxFileInfo[];
	fileContents: Record<string, FileContentCache>; // filePath -> FileContentCache
	lastUpdated: string; // ISO timestamp
	// Deployment information
	deployedUrl?: string;
	deploymentId?: string;
	deployedAt?: string;
	// Selected file information
	selectedFilePath?: string;
	// File tree current directory for navigation
	fileTreeCurrentDirectory?: string;
	// Terminal current working directory
	currentWorkingDirectory?: string;
	// Terminal history (commands and outputs with their cwd)
	terminalHistory?: TerminalHistoryLine[];
	type?: CodeAgentType;
}

// Main storage structure: [sandboxId:sessionId] -> AgentPreviewStorage
export interface AgentPreviewStorageMap {
	[key: string]: AgentPreviewStorage;
}

type AgentPreviewSyncMessage =
	| {
			type: "fileListUpdated";
			sandboxId: string;
			sessionId: string;
			fileList: SandboxFileInfo[];
			selectedFilePath?: string;
			fileTreeCurrentDirectory?: string;
	  }
	| {
			type: "fileContentUpdated";
			sandboxId: string;
			sessionId: string;
			filePath: string;
			content: string;
			modifiedTime?: string;
	  }
	| {
			type: "deploymentUpdated";
			sandboxId: string;
			sessionId: string;
			url: string;
			deploymentId: string;
			deployedAt: string;
	  }
	| {
			type: "fileContentsCleared";
			sandboxId: string;
			sessionId: string;
	  };

// Helper function to get ISO timestamp string
function getISOString(): string {
	return new Date().toISOString();
}

// Get storage key for a sandbox + session combination
function getStorageKey(sandboxId: string, sessionId: string): string {
	return `${sandboxId}:${sessionId}`;
}

// Get threadId from window.tab or default to "shell"
const threadId = getThreadId();
const syncInstanceId =
	typeof crypto !== "undefined" && "randomUUID" in crypto && crypto.randomUUID
		? crypto.randomUUID()
		: `s-${Date.now()}-${Math.random()}`;
const SYNC_STORAGE_KEY = "agent-preview-sync-channel";

function cloneForChannel<T>(data: T): T {
	try {
		if (typeof structuredClone === "function") {
			return structuredClone(data);
		}
	} catch (_e) {
		// fall through
	}
	try {
		// Performance: Use $state.snapshot() instead of JSON.parse(JSON.stringify())
		return $state.snapshot(data) as T;
	} catch (_e) {
		return data;
	}
}

// Initialize PersistedState with empty map (per-thread storage)
const persistedAgentPreviewStorage = new PersistedState<AgentPreviewStorageMap>(
	"AgentPreviewStorage:agent-preview-data-" + threadId,
	{},
);

type SyncEnvelope<T extends AgentPreviewSyncMessage> = T & {
	sourceInstanceId: string;
	timestamp: number;
	_id: string;
};
export type AgentPreviewSyncEnvelope = SyncEnvelope<AgentPreviewSyncMessage>;

class SyncBus {
	private channel: BroadcastChannel | null = null;
	private listeners = new SvelteSet<(message: SyncEnvelope<AgentPreviewSyncMessage>) => void>();
	private lastStorageMessageId: string | null = null;

	constructor(private readonly instanceId: string) {
		this.initChannel();

		if (typeof window !== "undefined" && "addEventListener" in window) {
			window.addEventListener("storage", this.handleStorageEvent);
		}
	}

	publish(message: AgentPreviewSyncMessage) {
		const safeMessage = cloneForChannel(message);
		const envelope: SyncEnvelope<AgentPreviewSyncMessage> = {
			...safeMessage,
			sourceInstanceId: this.instanceId,
			timestamp: Date.now(),
			_id:
				typeof crypto !== "undefined" && "randomUUID" in crypto && crypto.randomUUID
					? crypto.randomUUID()
					: `m-${Date.now()}-${Math.random()}`,
		};

		for (const l of this.listeners) {
			l(envelope);
		}

		if (this.channel) {
			try {
				this.channel.postMessage(envelope);
			} catch (e) {
				logger.error("Broadcast failed", e);
			}
		}

		try {
			localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(envelope));
		} catch (e) {
			logger.warn("Storage sync failed", e);
		}
	}

	subscribe(listener: (message: SyncEnvelope<AgentPreviewSyncMessage>) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	dispose() {
		if (this.channel) {
			this.channel.close();
		}
		this.listeners = new SvelteSet();
		if (typeof window !== "undefined" && "removeEventListener" in window) {
			window.removeEventListener("storage", this.handleStorageEvent);
		}
	}

	private initChannel() {
		try {
			this.channel = new BroadcastChannel("agent-preview-sync");
			this.channel.onmessage = (
				event: MessageEvent<SyncEnvelope<AgentPreviewSyncMessage>>,
			) => {
				this.deliver(event.data);
			};
		} catch (e) {
			logger.warn("BroadcastChannel unavailable:", e);
			this.channel = null;
		}
	}

	private handleStorageEvent = (event: StorageEvent) => {
		if (event.key !== SYNC_STORAGE_KEY || !event.newValue) {
			return;
		}
		try {
			const parsed = JSON.parse(event.newValue) as SyncEnvelope<AgentPreviewSyncMessage>;
			this.deliver(parsed, true);
		} catch (e) {
			logger.warn("Failed to parse storage message", e);
		}
	};

	private deliver(message: SyncEnvelope<AgentPreviewSyncMessage>, fromStorage = false) {
		if (!message || message.sourceInstanceId === this.instanceId) {
			return;
		}
		if (fromStorage && message._id === this.lastStorageMessageId) {
			return;
		}
		if (fromStorage) {
			this.lastStorageMessageId = message._id;
		}

		for (const l of this.listeners) {
			try {
				l(message);
			} catch (e) {
				logger.error("Listener error", e);
			}
		}
	}
}

export type AgentPreviewTab =
	| "preview"
	| "code"
	| "terminal"
	| "skills"
	| "taskboard"
	| "openclaw-webui";

export class AgentPreviewState {
	isVisible = $state(false);
	mode = $state<HtmlPreviewMode>("preview");
	sandBoxId = $state<string | undefined>(undefined);
	isDeploying = $state(false);
	activeTab = $state<AgentPreviewTab>("preview");
	// Skills-only mode: when true, only shows skills tab (no sandbox required)
	isSkillsOnlyMode = $state(false);
	private syncBus = new SyncBus(syncInstanceId);

	// Use global preferencesSettings for isPinned
	get isPinned(): boolean {
		return preferencesSettings.previewPanelPinned;
	}

	get threadIdentifier(): string {
		return threadId;
	}

	get syncIdentifier(): string {
		return syncInstanceId;
	}

	constructor() {
		// syncBus handles broadcast + storage fanout and dedupe
		this.syncBus.subscribe((message) => this.handleIncomingSync(message));
	}

	// Track active execution states in memory only (not persisted)
	// Key: "sandboxId:sessionId" -> Value: boolean (isExecuting)
	activeExecutions = $state<Record<string, boolean>>({});

	/**
	 * Check if a command is currently executing for a session
	 */
	isExecuting(sandboxId: string, sessionId: string): boolean {
		const key = getStorageKey(sandboxId, sessionId);
		return this.activeExecutions[key] || false;
	}

	/**
	 * Set execution state for a session
	 */
	setExecuting(sandboxId: string, sessionId: string, isExecuting: boolean) {
		const key = getStorageKey(sandboxId, sessionId);
		this.activeExecutions = {
			...this.activeExecutions,
			[key]: isExecuting,
		};
	}

	// context = $state<HtmlPreviewContext | null>(null);

	/**
	 * Get the storage map (reactive)
	 */
	private get storageMap(): AgentPreviewStorageMap {
		const current = persistedAgentPreviewStorage.current;
		if (!current) {
			logger.warn("persistedAgentPreviewStorage.current is null/undefined");
		}
		return current || {};
	}

	/**
	 * Get the reactive storage object for a specific sandbox session
	 */
	getReactiveState(sandboxId: string, sessionId: string): AgentPreviewStorage | undefined {
		if (!sandboxId || !sessionId) {
			return undefined;
		}
		const key = getStorageKey(sandboxId, sessionId);
		return this.storageMap[key];
	}

	/**
	 * Synchronously update the storage state
	 */
	updateState(
		sandboxId: string,
		sessionId: string,
		updater: (state: AgentPreviewStorage) => Partial<AgentPreviewStorage>,
		lastUpdatedOverride?: string,
	): void {
		if (!sandboxId || !sessionId) {
			return;
		}

		const key = getStorageKey(sandboxId, sessionId);
		const currentState = this.storageMap[key] || {
			fileList: [],
			fileContents: {},
			lastUpdated: getISOString(),
		};

		const updates = updater(currentState);
		const newState: AgentPreviewStorage = {
			...currentState,
			...updates,
			lastUpdated: lastUpdatedOverride ?? getISOString(),
		};

		persistedAgentPreviewStorage.current = {
			...this.storageMap,
			[key]: newState,
		};
	}

	/**
	 * Load file list and contents from storage
	 */
	async loadFromStorage(
		sandboxId: string,
		sessionId: string,
	): Promise<AgentPreviewStorage | null> {
		if (!sandboxId || !sessionId) {
			return null;
		}

		// Wait for storage to be hydrated before accessing
		if (!persistedAgentPreviewStorage.isHydrated) {
			await persistedAgentPreviewStorage.refresh();
		}

		const key = getStorageKey(sandboxId, sessionId);
		const map = this.storageMap;
		const storage = map[key];

		return storage || null;
	}

	/**
	 * Save file list and contents to storage
	 */
	async saveToStorage(
		sandboxId: string,
		sessionId: string,
		data: AgentPreviewStorage,
		lastUpdatedOverride?: string,
	): Promise<void> {
		if (!sandboxId || !sessionId) {
			return;
		}

		const key = getStorageKey(sandboxId, sessionId);
		persistedAgentPreviewStorage.current = {
			...this.storageMap,
			[key]: {
				...data,
				lastUpdated: lastUpdatedOverride ?? getISOString(),
			},
		};
	}

	/**
	 * Get file content from storage
	 * @param currentModifiedTime - Current file's modified_time to check if cache is stale
	 */
	async getFileContent(
		sandboxId: string,
		sessionId: string,
		filePath: string,
		currentModifiedTime?: string,
	): Promise<string | null> {
		const storage = await this.loadFromStorage(sandboxId, sessionId);
		if (!storage) {
			return null;
		}

		const cached = storage.fileContents[filePath];
		if (!cached) {
			return null;
		}

		// Handle backward compatibility: old format stored content as string directly
		if (typeof cached === "string") {
			return null; // Force reload to update to new format
		}

		// Check cache TTL (time to live)
		if (cached.ttl) {
			const cacheAge = Date.now() - new SvelteDate(cached.cachedAt).getTime();
			if (cacheAge > cached.ttl) {
				return null; // Cache expired
			}
		}

		// If file was modified after caching, cache is stale
		if (
			currentModifiedTime &&
			cached.modifiedTime &&
			currentModifiedTime !== cached.modifiedTime
		) {
			return null; // Force reload from API
		}

		return cached.content;
	}

	/**
	 * Save file content to storage
	 */
	async setFileContent(
		sandboxId: string,
		sessionId: string,
		filePath: string,
		content: string,
		modifiedTime?: string,
	): Promise<void> {
		const storage = await this.loadFromStorage(sandboxId, sessionId);
		const updatedStorage: AgentPreviewStorage = {
			fileList: storage?.fileList || [],
			fileContents: {
				...(storage?.fileContents || {}),
				[filePath]: {
					content,
					modifiedTime,
					cachedAt: getISOString(),
				},
			},
			lastUpdated: getISOString(),
			// Preserve deployment info when saving file content
			deployedUrl: storage?.deployedUrl,
			deploymentId: storage?.deploymentId,
			deployedAt: storage?.deployedAt,
			selectedFilePath: storage?.selectedFilePath,
			fileTreeCurrentDirectory: storage?.fileTreeCurrentDirectory,
			currentWorkingDirectory: storage?.currentWorkingDirectory,
			terminalHistory: storage?.terminalHistory,
			type: storage?.type,
		};
		const timestamp = getISOString();
		await this.saveToStorage(sandboxId, sessionId, updatedStorage, timestamp);

		this.syncBus.publish({
			type: "fileContentUpdated",
			sandboxId,
			sessionId,
			filePath,
			content,
			modifiedTime,
		});
	}

	/**
	 * Clear file contents cache (but keep file list)
	 * Useful when refreshing file list to ensure users see latest content
	 */
	async clearFileContents(sandboxId: string, sessionId: string): Promise<void> {
		if (!sandboxId || !sessionId) {
			return;
		}

		const storage = await this.loadFromStorage(sandboxId, sessionId);
		if (storage) {
			await this.saveToStorage(sandboxId, sessionId, {
				fileList: storage.fileList,
				fileContents: {}, // Clear all file contents
				lastUpdated: getISOString(),
				deployedUrl: storage.deployedUrl,
				deploymentId: storage.deploymentId,
				deployedAt: storage.deployedAt,
				selectedFilePath: storage.selectedFilePath,
				fileTreeCurrentDirectory: storage.fileTreeCurrentDirectory,
				currentWorkingDirectory: storage.currentWorkingDirectory,
				terminalHistory: storage.terminalHistory,
				type: storage.type,
			});
		}

		this.syncBus.publish({
			type: "fileContentsCleared",
			sandboxId,
			sessionId,
		});
	}

	onSync(listener: (message: AgentPreviewSyncEnvelope) => void): () => void {
		return this.syncBus.subscribe(listener);
	}

	broadcastFileListSync(params: {
		sandboxId: string;
		sessionId: string;
		fileList: SandboxFileInfo[];
		selectedFilePath?: string | null;
		fileTreeCurrentDirectory?: string;
	}): void {
		const message: AgentPreviewSyncMessage = {
			type: "fileListUpdated",
			sandboxId: params.sandboxId,
			sessionId: params.sessionId,
			fileList: params.fileList,
			selectedFilePath: params.selectedFilePath ?? undefined,
			fileTreeCurrentDirectory: params.fileTreeCurrentDirectory,
		};
		this.syncBus.publish(message);
	}

	broadcastFileContentsCleared(params: { sandboxId: string; sessionId: string }): void {
		const message: AgentPreviewSyncMessage = {
			type: "fileContentsCleared",
			sandboxId: params.sandboxId,
			sessionId: params.sessionId,
		};
		this.syncBus.publish(message);
	}

	private handleIncomingSync(message: AgentPreviewSyncMessage) {
		const envelope = message as SyncEnvelope<AgentPreviewSyncMessage>;
		if (!envelope || envelope.sourceInstanceId === this.syncIdentifier) {
			return;
		}

		const { sandboxId, sessionId } = envelope;
		if (!sandboxId || !sessionId) {
			return;
		}

		const existing = this.storageMap[getStorageKey(sandboxId, sessionId)];
		const existingUpdatedAt = existing?.lastUpdated
			? new SvelteDate(existing.lastUpdated).getTime()
			: 0;

		if (existingUpdatedAt > envelope.timestamp) {
			return;
		}

		if (envelope.type === "fileListUpdated") {
			this.updateState(
				sandboxId,
				sessionId,
				(state) => ({
					...state,
					fileList: envelope.fileList,
					selectedFilePath: envelope.selectedFilePath ?? state.selectedFilePath,
					fileTreeCurrentDirectory:
						envelope.fileTreeCurrentDirectory ?? state.fileTreeCurrentDirectory,
				}),
				new SvelteDate(envelope.timestamp).toISOString(),
			);
		} else if (envelope.type === "fileContentUpdated") {
			const { filePath, content, modifiedTime } = envelope;
			this.updateState(
				sandboxId,
				sessionId,
				(state) => ({
					...state,
					fileContents: {
						...state.fileContents,
						[filePath]: {
							content,
							modifiedTime,
							cachedAt: new SvelteDate(envelope.timestamp).toISOString(),
						},
					},
				}),
				new SvelteDate(envelope.timestamp).toISOString(),
			);
		} else if (envelope.type === "deploymentUpdated") {
			this.updateState(
				sandboxId,
				sessionId,
				(state) => ({
					...state,
					deployedUrl: envelope.url,
					deploymentId: envelope.deploymentId,
					deployedAt: envelope.deployedAt,
				}),
				new SvelteDate(envelope.timestamp).toISOString(),
			);
		} else if (envelope.type === "fileContentsCleared") {
			this.updateState(
				sandboxId,
				sessionId,
				(state) => ({
					...state,
					fileContents: {},
				}),
				new SvelteDate(envelope.timestamp).toISOString(),
			);
		}

		// Local listeners already invoked by SyncBus before this method runs
	}

	/**
	 * Set deployment information for a sandbox session
	 */
	async setDeploymentInfo(
		sandboxId: string,
		sessionId: string,
		url: string,
		deploymentId: string,
	): Promise<void> {
		if (!sandboxId || !sessionId) {
			return;
		}

		const storage = await this.loadFromStorage(sandboxId, sessionId);
		const deployedAt = getISOString();
		const updatedStorage: AgentPreviewStorage = {
			fileList: storage?.fileList || [],
			fileContents: storage?.fileContents || {},
			lastUpdated: getISOString(),
			deployedUrl: url,
			deploymentId: deploymentId,
			deployedAt,
			selectedFilePath: storage?.selectedFilePath, // Preserve selected file path
			fileTreeCurrentDirectory: storage?.fileTreeCurrentDirectory,
			currentWorkingDirectory: storage?.currentWorkingDirectory,
			terminalHistory: storage?.terminalHistory,
			type: storage?.type,
		};
		await this.saveToStorage(sandboxId, sessionId, updatedStorage);

		// Broadcast deployment changes as a dedicated event instead of reusing file list updates.
		this.syncBus.publish({
			type: "deploymentUpdated",
			sandboxId,
			sessionId,
			url,
			deploymentId,
			deployedAt,
		});
	}

	/**
	 * Get deployment information for a sandbox session
	 */
	async getDeploymentInfo(
		sandboxId: string,
		sessionId: string,
	): Promise<{ url: string; deploymentId: string; deployedAt: string } | null> {
		if (!sandboxId || !sessionId) {
			return null;
		}

		const storage = await this.loadFromStorage(sandboxId, sessionId);
		if (!storage || !storage.deployedUrl || !storage.deploymentId) {
			return null;
		}

		return {
			url: storage.deployedUrl,
			deploymentId: storage.deploymentId,
			deployedAt: storage.deployedAt || storage.lastUpdated,
		};
	}

	/**
	 * Set selected file path for a sandbox session
	 */
	async setSelectedFilePath(
		sandboxId: string,
		sessionId: string,
		filePath: string,
	): Promise<void> {
		if (!sandboxId || !sessionId) {
			return;
		}

		const storage = await this.loadFromStorage(sandboxId, sessionId);
		const updatedStorage: AgentPreviewStorage = {
			fileList: storage?.fileList || [],
			fileContents: storage?.fileContents || {},
			lastUpdated: getISOString(),
			deployedUrl: storage?.deployedUrl,
			deploymentId: storage?.deploymentId,
			deployedAt: storage?.deployedAt,
			selectedFilePath: filePath,
			fileTreeCurrentDirectory: storage?.fileTreeCurrentDirectory,
			currentWorkingDirectory: storage?.currentWorkingDirectory,
			terminalHistory: storage?.terminalHistory,
			type: storage?.type,
		};
		await this.saveToStorage(sandboxId, sessionId, updatedStorage);
	}

	/**
	 * Get selected file path for a sandbox session
	 */
	async getSelectedFilePath(sandboxId: string, sessionId: string): Promise<string | null> {
		const storage = await this.loadFromStorage(sandboxId, sessionId);
		return storage?.selectedFilePath || null;
	}

	/**
	 * Get current working directory for a sandbox session
	 */
	async getCurrentWorkingDirectory(sandboxId: string, sessionId: string): Promise<string | null> {
		const storage = await this.loadFromStorage(sandboxId, sessionId);
		return storage?.currentWorkingDirectory || null;
	}

	/**
	 * Set current working directory for a sandbox session
	 */
	async setCurrentWorkingDirectory(
		sandboxId: string,
		sessionId: string,
		cwd: string,
	): Promise<void> {
		if (!sandboxId || !sessionId) {
			return;
		}

		const storage = await this.loadFromStorage(sandboxId, sessionId);
		const updatedStorage: AgentPreviewStorage = {
			fileList: storage?.fileList || [],
			fileContents: storage?.fileContents || {},
			lastUpdated: getISOString(),
			deployedUrl: storage?.deployedUrl,
			deploymentId: storage?.deploymentId,
			deployedAt: storage?.deployedAt,
			selectedFilePath: storage?.selectedFilePath,
			fileTreeCurrentDirectory: storage?.fileTreeCurrentDirectory,
			currentWorkingDirectory: cwd,
			terminalHistory: storage?.terminalHistory,
			type: storage?.type,
		};
		await this.saveToStorage(sandboxId, sessionId, updatedStorage);
	}

	/**
	 * Get terminal history for a sandbox session
	 */
	async getTerminalHistory(
		sandboxId: string,
		sessionId: string,
	): Promise<TerminalHistoryLine[] | null> {
		const storage = await this.loadFromStorage(sandboxId, sessionId);
		return storage?.terminalHistory || null;
	}

	/**
	 * Set terminal history for a sandbox session
	 */
	async setTerminalHistory(
		sandboxId: string,
		sessionId: string,
		history: TerminalHistoryLine[],
	): Promise<void> {
		if (!sandboxId || !sessionId) {
			return;
		}

		const storage = await this.loadFromStorage(sandboxId, sessionId);
		const updatedStorage: AgentPreviewStorage = {
			fileList: storage?.fileList || [],
			fileContents: storage?.fileContents || {},
			lastUpdated: getISOString(),
			deployedUrl: storage?.deployedUrl,
			deploymentId: storage?.deploymentId,
			deployedAt: storage?.deployedAt,
			selectedFilePath: storage?.selectedFilePath,
			fileTreeCurrentDirectory: storage?.fileTreeCurrentDirectory,
			currentWorkingDirectory: storage?.currentWorkingDirectory,
			terminalHistory: history,
			type: storage?.type,
		};
		await this.saveToStorage(sandboxId, sessionId, updatedStorage);
	}

	openPreview(sandBoxId: string) {
		this.sandBoxId = sandBoxId;
		this.mode = "preview";
		this.isSkillsOnlyMode = false;
		this.isVisible = true;
	}

	closePreview() {
		this.isVisible = false;
		this.mode = "preview";
		this.activeTab = "preview";
		this.isSkillsOnlyMode = false;
	}

	setActiveTab(tab: AgentPreviewTab) {
		this.activeTab = tab;
	}

	openSkillsTab() {
		this.activeTab = "skills";
		this.isVisible = true;
		this.isSkillsOnlyMode = !codeAgentState.currentSessionId || !codeAgentState.sandboxId;
	}

	/**
	 * Open in skills-only mode (no sandbox required)
	 * This mode only shows the skills tab for managing skills
	 */
	openSkillsOnlyMode() {
		this.isSkillsOnlyMode = true;
		this.activeTab = "skills";
		this.isVisible = true;
	}

	openTaskboardTab() {
		this.activeTab = "taskboard";
		this.isVisible = true;
		this.isSkillsOnlyMode = !codeAgentState.currentSessionId || !codeAgentState.sandboxId;
	}

	openOpenClawWebUiTab() {
		this.activeTab = "openclaw-webui";
		this.isVisible = true;
		this.isSkillsOnlyMode = false;
	}

	setMode(mode: HtmlPreviewMode) {
		this.mode = mode;
	}

	togglePin() {
		preferencesSettings.togglePreviewPanelPinned();
	}

	// storage events handled inside SyncBus
}

export const agentPreviewState = new AgentPreviewState();
