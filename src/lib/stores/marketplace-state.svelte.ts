/**
 * Marketplace State Management
 *
 * Manages plugin marketplace state in the renderer process
 */

import type { PluginMarketEntry } from "@shared/types";

const { registryService } = window.electronAPI;

/**
 * Marketplace State Class
 * Manages marketplace plugins and search
 */
class MarketplaceState {
	/** All marketplace plugins */
	marketplacePlugins = $state<PluginMarketEntry[]>([]);

	/** Featured plugins */
	featuredPlugins = $state<PluginMarketEntry[]>([]);

	/** Search results */
	searchResults = $state<PluginMarketEntry[]>([]);

	/** Current search query */
	searchQuery = $state("");

	/** Loading state */
	isLoading = $state(false);

	/** Error state */
	error = $state<string | null>(null);

	/** Is initialized */
	private initialized = false;

	/** Last refresh timestamp */
	lastRefresh = $state<number>(0);

	/**
	 * Initialize marketplace state
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		console.log("[MarketplaceState] Initializing...");

		try {
			await this.refreshMarketplace();
			this.initialized = true;
			console.log("[MarketplaceState] Initialized successfully");
		} catch (error) {
			console.error("[MarketplaceState] Initialization failed:", error);
			this.error = error instanceof Error ? error.message : "Failed to initialize marketplace";
		}
	}

	/**
	 * Refresh marketplace plugins
	 */
	async refreshMarketplace(force = false): Promise<void> {
		this.isLoading = true;
		this.error = null;

		try {
			console.log("[MarketplaceState] Refreshing marketplace...");

			// Force refresh if requested
			let plugins: PluginMarketEntry[];
			if (force) {
				plugins = await registryService.refreshRegistry();
			} else {
				plugins = await registryService.getMarketplacePlugins();
			}

			// Filter out invalid entries (missing metadata or metadata.id)
			this.marketplacePlugins = plugins.filter((p) => p && p.metadata && p.metadata.id);

			// Update featured plugins
			const featured = await registryService.getFeaturedPlugins();
			this.featuredPlugins = featured.filter((p) => p && p.metadata && p.metadata.id);

			this.lastRefresh = Date.now();

			console.log(
				`[MarketplaceState] Refreshed: ${this.marketplacePlugins.length} plugins, ` +
					`${this.featuredPlugins.length} featured`,
			);

			// Re-apply search if there's an active query
			if (this.searchQuery.trim()) {
				await this.search(this.searchQuery);
			} else {
				this.searchResults = this.marketplacePlugins;
			}
		} catch (error) {
			console.error("[MarketplaceState] Failed to refresh marketplace:", error);
			this.error = error instanceof Error ? error.message : "Failed to refresh marketplace";
			throw error;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Search marketplace plugins
	 */
	async search(query: string): Promise<void> {
		this.searchQuery = query;

		if (!query.trim()) {
			this.searchResults = this.marketplacePlugins;
			return;
		}

		try {
			console.log(`[MarketplaceState] Searching for: "${query}"`);
			const results = await registryService.searchMarketplacePlugins(query);

			// Filter out invalid entries
			this.searchResults = results.filter((p) => p && p.metadata && p.metadata.id);

			console.log(`[MarketplaceState] Found ${this.searchResults.length} results`);
		} catch (error) {
			console.error("[MarketplaceState] Search failed:", error);
			this.error = error instanceof Error ? error.message : "Search failed";
			throw error;
		}
	}

	/**
	 * Get plugin by ID
	 */
	async getPlugin(pluginId: string): Promise<PluginMarketEntry | null> {
		try {
			return await registryService.getMarketplacePlugin(pluginId);
		} catch (error) {
			console.error(`[MarketplaceState] Failed to get plugin ${pluginId}:`, error);
			throw error;
		}
	}

	/**
	 * Get cache info
	 */
	async getCacheInfo(): Promise<{
		valid: boolean;
		age: number;
		pluginCount: number;
		lastUpdated?: string;
	}> {
		try {
			return await registryService.getCacheInfo();
		} catch (error) {
			console.error("[MarketplaceState] Failed to get cache info:", error);
			return { valid: false, age: 0, pluginCount: 0 };
		}
	}

	/**
	 * Clear cache
	 */
	async clearCache(): Promise<void> {
		try {
			console.log("[MarketplaceState] Clearing cache...");
			await registryService.clearCache();
			this.marketplacePlugins = [];
			this.featuredPlugins = [];
			this.searchResults = [];
			this.lastRefresh = 0;
			console.log("[MarketplaceState] Cache cleared");
		} catch (error) {
			console.error("[MarketplaceState] Failed to clear cache:", error);
			throw error;
		}
	}

	/**
	 * Get filtered plugins by tag
	 */
	getPluginsByTag(tag: string): PluginMarketEntry[] {
		return this.marketplacePlugins.filter((p) =>
			p.metadata.tags?.some((t) => t.toLowerCase() === tag.toLowerCase()),
		);
	}

	/**
	 * Get all unique tags
	 */
	get allTags(): string[] {
		const tags: string[] = [];
		this.marketplacePlugins.forEach((plugin) => {
			plugin.metadata.tags?.forEach((tag) => {
				if (!tags.includes(tag)) {
					tags.push(tag);
				}
			});
		});
		return tags.sort();
	}

	/**
	 * Get top rated plugins
	 */
	get topRatedPlugins(): PluginMarketEntry[] {
		return [...this.marketplacePlugins]
			.filter((p) => p.ratingCount > 0)
			.sort((a, b) => b.rating - a.rating)
			.slice(0, 10);
	}

	/**
	 * Get most downloaded plugins
	 */
	get mostDownloadedPlugins(): PluginMarketEntry[] {
		return [...this.marketplacePlugins].sort((a, b) => b.downloads - a.downloads).slice(0, 10);
	}

	/**
	 * Get recently updated plugins
	 */
	get recentlyUpdatedPlugins(): PluginMarketEntry[] {
		return [...this.marketplacePlugins]
			.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
			.slice(0, 10);
	}
}

// Singleton instance
export const marketplaceState = new MarketplaceState();

// Auto-initialize when module loads
if (typeof window !== "undefined") {
	marketplaceState.initialize().catch((error) => {
		console.error("[MarketplaceState] Auto-initialization failed:", error);
	});
}
