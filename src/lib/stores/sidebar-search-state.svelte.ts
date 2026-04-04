/**
 * State management for sidebar search functionality
 */

import type { MessagePart } from "$lib/utils/attachment-converter";
import { createLogger } from "@shared/logger";

const logger = createLogger("state");
import type { ThreadData } from "@shared/types";

const SEARCH_QUERY_STORAGE_KEY = "SidebarSearch:current-query";
const SEARCH_RESULTS_STORAGE_KEY = "SidebarSearch:current-results";
const THREAD_YIELD_EVERY = 6;
const MESSAGE_YIELD_EVERY = 200;
const scheduleNextFrame =
	typeof requestAnimationFrame === "function"
		? requestAnimationFrame
		: (callback: FrameRequestCallback) => setTimeout(callback, 0);

function yieldToMain(): Promise<void> {
	return new Promise((resolve) => scheduleNextFrame(() => resolve()));
}

type SidebarSearchResultsPayload = {
	query: string;
	resultIds: string[];
	updatedAt: number;
};

class SidebarSearchState {
	private focusTriggerCallbacks: Array<() => void> = [];
	private hasInitialized = false;
	private searchRunId = 0;

	// Local search state for this tab
	#localSearchQuery = $state("");

	// 缓存的搜索结果 ID（搜索完成后写入）
	#cachedSearchResultIds: string[] = [];
	#cachedSearchQuery = $state("");
	#hasCachedResults = $state(false);
	#cachedResultsUpdatedAt = $state(0);

	// Initial search result IDs from tab creation
	#initialSearchResultIds: string[] | null = null;

	// Flag to prevent re-broadcasting when receiving a broadcast update
	#isBroadcastUpdate = false;

	/**
	 * Initialize search state for this tab
	 * Reads initial search query and results from window.tab if available,
	 * then falls back to reading the current global search query from storage
	 */
	initializeForTab(): void {
		if (this.hasInitialized) return;
		this.hasInitialized = true;

		const tab = window.tab as {
			initialSearchQuery?: string;
			initialSearchResultIds?: string[];
		};

		// Check if tab has initial search query (from clicking a search result)
		if (tab?.initialSearchQuery) {
			this.#localSearchQuery = tab.initialSearchQuery;
			logger.info("Initialized with search query:", tab.initialSearchQuery);
		}

		// Check if tab has initial search results
		if (Array.isArray(tab?.initialSearchResultIds)) {
			this.#initialSearchResultIds = tab.initialSearchResultIds;
			this.#cachedSearchResultIds = tab.initialSearchResultIds;
			const normalized = this.#normalizeQuery(tab.initialSearchQuery ?? "");
			if (normalized) {
				this.#cachedSearchQuery = normalized;
				this.#hasCachedResults = true;
				this.#cachedResultsUpdatedAt = Date.now();
			}
			logger.info(
				"Initialized with search results:",
				tab.initialSearchResultIds.length,
				"items",
			);
		}

		// If no initial search query from tab creation, read from storage
		// to sync with the current global search state
		if (!tab?.initialSearchQuery) {
			this.#loadSearchQueryFromStorage();
		}

		// 读取缓存的搜索结果，便于跨标签复用
		if (!tab?.initialSearchQuery) {
			this.#loadSearchResultsFromStorage();
		}
	}

	/**
	 * Load the current global search query from storage (async)
	 * Used when a new tab is created without search context
	 */
	async #loadSearchQueryFromStorage(): Promise<void> {
		try {
			if (typeof window === "undefined" || !window.electronAPI?.storageService) return;
			const stored =
				await window.electronAPI.storageService.getItem(SEARCH_QUERY_STORAGE_KEY);
			if (typeof stored === "string" && stored.trim()) {
				this.#isBroadcastUpdate = true;
				this.#localSearchQuery = stored;
				this.#isBroadcastUpdate = false;
			}
		} catch {
			// Ignore storage read errors
		}
	}

	/**
	 * 从存储加载缓存的搜索结果（异步）
	 * 用于跨标签复用，避免重复搜索
	 */
	async #loadSearchResultsFromStorage(): Promise<void> {
		try {
			if (typeof window === "undefined" || !window.electronAPI?.storageService) return;
			const stored = (await window.electronAPI.storageService.getItem(
				SEARCH_RESULTS_STORAGE_KEY,
			)) as SidebarSearchResultsPayload | null;
			if (!stored || typeof stored.query !== "string" || !Array.isArray(stored.resultIds))
				return;
			const normalized = this.#normalizeQuery(stored.query);
			if (!normalized) return;
			this.#applySearchResults(normalized, stored.resultIds, {
				broadcast: false,
				persist: false,
			});
		} catch {
			// Ignore storage read errors
		}
	}

	/**
	 * Get initial search result IDs (only available on first render)
	 */
	getInitialSearchResultIds(): string[] | null {
		const result = this.#initialSearchResultIds;
		// Clear after first access to prevent stale data
		this.#initialSearchResultIds = null;
		return result;
	}

	/**
	 * Get the current search query and result IDs to pass when creating a new tab
	 */
	getSearchDataForNewTab(): { query: string; resultIds: string[] } | undefined {
		const query = this.#localSearchQuery.trim();
		if (!query) return undefined;
		const normalized = this.#normalizeQuery(query);
		const resultIds =
			this.#hasCachedResults && normalized === this.#cachedSearchQuery
				? this.#cachedSearchResultIds
				: [];
		return {
			query,
			resultIds,
		};
	}

	/**
	 * Search query state - synced globally across all tabs
	 */
	get searchQuery(): string {
		return this.#localSearchQuery;
	}

	set searchQuery(value: string) {
		const previousNormalized = this.#normalizeQuery(this.#localSearchQuery);
		const normalized = this.#normalizeQuery(value);
		this.#localSearchQuery = value;
		// 查询变化时清理缓存结果
		if (normalized !== previousNormalized) {
			this.#invalidateCachedResults(normalized);
		}

		// Broadcast to other tabs unless this change originated from a broadcast
		if (!this.#isBroadcastUpdate) {
			this.#broadcastSearchChange(value);
		}
	}

	/**
	 * Apply a search query change from another tab's broadcast
	 * Prevents re-broadcasting the change back
	 */
	applyBroadcastUpdate(query: string): void {
		this.#isBroadcastUpdate = true;
		this.searchQuery = query;
		this.#isBroadcastUpdate = false;
	}

	/**
	 * 应用来自其他标签页的搜索结果广播
	 * 避免再次广播和持久化
	 */
	applySearchResultsBroadcast(query: string, resultIds: string[]): void {
		this.#applySearchResults(query, resultIds, {
			broadcast: false,
			persist: false,
		});
	}

	/**
	 * 设置某个查询的搜索结果，可选是否广播/持久化
	 */
	setSearchResults(
		query: string,
		resultIds: string[],
		options?: { broadcast?: boolean; persist?: boolean },
	): void {
		this.#applySearchResults(query, resultIds, options);
	}

	/**
	 * 获取指定查询的缓存结果 ID
	 * 没有缓存时返回 null
	 */
	getCachedSearchResultIdsForQuery(query: string): string[] | null {
		const normalized = this.#normalizeQuery(query);
		const _ = this.#cachedResultsUpdatedAt;
		if (!normalized) return null;
		if (!this.#hasCachedResults) return null;
		if (normalized !== this.#cachedSearchQuery) return null;
		return this.#cachedSearchResultIds;
	}

	/**
	 * 广播搜索词变化并持久化到存储
	 */
	#broadcastSearchChange(query: string): void {
		if (typeof window !== "undefined" && window.electronAPI?.broadcastService) {
			window.electronAPI.broadcastService.broadcastExcludeSource("sidebar-search-changed", {
				query,
			});
		}

		// Persist to storage so newly created tabs can read it
		if (typeof window !== "undefined" && window.electronAPI?.storageService) {
			window.electronAPI.storageService.setItem(SEARCH_QUERY_STORAGE_KEY, query);
		}
	}

	#broadcastSearchResults(query: string, resultIds: string[]): void {
		if (typeof window !== "undefined" && window.electronAPI?.broadcastService) {
			window.electronAPI.broadcastService.broadcastExcludeSource(
				"sidebar-search-results-updated",
				{
					query,
					resultIds,
				},
			);
		}
	}

	#persistSearchResults(query: string, resultIds: string[]): void {
		if (typeof window === "undefined" || !window.electronAPI?.storageService) return;
		const payload: SidebarSearchResultsPayload = {
			query,
			resultIds,
			updatedAt: Date.now(),
		};
		window.electronAPI.storageService.setItem(SEARCH_RESULTS_STORAGE_KEY, payload);
	}

	#applySearchResults(
		query: string,
		resultIds: string[],
		options?: { broadcast?: boolean; persist?: boolean },
	): void {
		const normalized = this.#normalizeQuery(query);
		if (!normalized) {
			this.#clearCachedResults();
			return;
		}

		this.#cachedSearchQuery = normalized;
		this.#cachedSearchResultIds = Array.isArray(resultIds) ? resultIds : [];
		this.#hasCachedResults = true;
		this.#cachedResultsUpdatedAt = Date.now();

		const shouldBroadcast = options?.broadcast ?? true;
		const shouldPersist = options?.persist ?? true;

		if (shouldBroadcast) {
			this.#broadcastSearchResults(normalized, this.#cachedSearchResultIds);
		}
		if (shouldPersist) {
			this.#persistSearchResults(normalized, this.#cachedSearchResultIds);
		}
	}

	#invalidateCachedResults(normalizedQuery: string): void {
		this.#cachedSearchQuery = normalizedQuery;
		this.#cachedSearchResultIds = [];
		this.#hasCachedResults = false;
		this.#cachedResultsUpdatedAt = Date.now();
	}

	#clearCachedResults(): void {
		this.#cachedSearchQuery = "";
		this.#cachedSearchResultIds = [];
		this.#hasCachedResults = false;
		this.#cachedResultsUpdatedAt = Date.now();
	}

	#normalizeQuery(query: string): string {
		return query.trim().toLowerCase();
	}

	async #hasThreadMessageMatch(
		threadId: string,
		searchTerm: string,
		runId: number,
	): Promise<boolean> {
		try {
			const messagesData = await window.electronAPI.storageService.getItem(
				`app-chat-messages:${threadId}`,
			);
			if (runId !== this.searchRunId) return false;
			if (!Array.isArray(messagesData)) return false;

			let processedParts = 0;

			for (const message of messagesData) {
				if (runId !== this.searchRunId) return false;
				if (!Array.isArray(message?.parts)) continue;

				for (const part of message.parts as MessagePart[]) {
					if (runId !== this.searchRunId) return false;
					if (part.type === "text" && typeof part.text === "string") {
						if (part.text.toLowerCase().includes(searchTerm)) {
							return true;
						}
					}

					processedParts += 1;
					if (processedParts % MESSAGE_YIELD_EVERY === 0) {
						await yieldToMain();
					}
				}
			}
		} catch (error) {
			logger.warn(`Failed to load messages for thread ${threadId}:`, error);
		}

		return false;
	}

	/**
	 * 根据当前搜索词过滤线程列表
	 */
	async searchThreads(threads: ThreadData[]): Promise<ThreadData[]> {
		// 每次搜索开始时递增，旧的搜索会因为 runId 不匹配而被中断
		const runId = (this.searchRunId += 1);
		const searchTerm = this.#normalizeQuery(this.#localSearchQuery);

		if (!searchTerm) return threads;

		const cachedResultIds = this.getCachedSearchResultIdsForQuery(searchTerm);
		if (cachedResultIds !== null) {
			const resultSet = new Set(cachedResultIds);
			return threads.filter((t) => resultSet.has(t.threadId));
		}

		const initialResultIds = this.getInitialSearchResultIds();
		if (initialResultIds) {
			this.setSearchResults(searchTerm, initialResultIds, {
				broadcast: false,
				persist: false,
			});
			const resultSet = new Set(initialResultIds);
			return threads.filter((t) => resultSet.has(t.threadId));
		}

		const results: ThreadData[] = [];
		let processedThreads = 0;

		for (const threadData of threads) {
			if (runId !== this.searchRunId) return results;

			if (threadData.thread.title.toLowerCase().includes(searchTerm)) {
				results.push(threadData);
			} else {
				const hasMatch = await this.#hasThreadMessageMatch(
					threadData.threadId,
					searchTerm,
					runId,
				);
				if (runId !== this.searchRunId) return results;
				if (hasMatch) {
					results.push(threadData);
				}
			}

			processedThreads += 1;
			if (processedThreads % THREAD_YIELD_EVERY === 0) {
				await yieldToMain();
			}
		}

		if (runId === this.searchRunId) {
			this.setSearchResults(
				searchTerm,
				results.map((t) => t.threadId),
			);
		}

		return results;
	}

	/**
	 * Register a callback to be called when search should be focused
	 */
	registerFocusCallback(callback: () => void): () => void {
		this.focusTriggerCallbacks.push(callback);

		// Return cleanup function
		return () => {
			const index = this.focusTriggerCallbacks.indexOf(callback);
			if (index > -1) {
				this.focusTriggerCallbacks.splice(index, 1);
			}
		};
	}

	/**
	 * Trigger focus on the search input
	 */
	triggerFocus(): void {
		this.focusTriggerCallbacks.forEach((callback) => callback());
	}

	/**
	 * Clear the search query
	 */
	clearSearch(): void {
		this.searchQuery = "";
	}
}

export const sidebarSearchState = new SidebarSearchState();
