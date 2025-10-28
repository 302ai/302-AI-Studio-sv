/**
 * Registry Service
 *
 * Manages plugin registry loading and caching
 */

import type { IpcMainInvokeEvent } from "electron";
import type { PluginMarketEntry } from "@shared/types";
import ky from "ky";
import path from "path";
import fs from "fs-extra";
import os from "os";

/**
 * Registry configuration
 */
const REGISTRY_CONFIG = {
	// Official registry URL (GitHub raw content)
	url: "https://raw.githubusercontent.com/302ai/302-AI-Studio-SV/main/packages/plugin-registry/registry.json",

	// Alternative: Use GitHub API (has rate limits)
	// url: "https://api.github.com/repos/302ai/302-AI-Studio-SV/contents/packages/plugin-registry/registry.json",

	// Cache configuration
	cacheMaxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
	cacheDir: path.join(os.tmpdir(), "302-ai-studio", "plugin-registry-cache"),
	cacheFile: "registry.json",
};

interface RegistryData {
	version: string;
	lastUpdated: string;
	plugins: PluginMarketEntry[];
}

interface CacheMetadata {
	timestamp: number;
	etag?: string;
	version?: string;
}

/**
 * Registry Service Class
 *
 * Provides IPC methods for accessing the plugin registry
 */
export class RegistryService {
	private cache: RegistryData | null = null;
	private cacheMetadata: CacheMetadata | null = null;
	private loading: Promise<RegistryData> | null = null;

	/**
	 * Get the cache file path
	 */
	private getCachePath(): string {
		return path.join(REGISTRY_CONFIG.cacheDir, REGISTRY_CONFIG.cacheFile);
	}

	/**
	 * Get the cache metadata file path
	 */
	private getCacheMetadataPath(): string {
		return path.join(REGISTRY_CONFIG.cacheDir, "metadata.json");
	}

	/**
	 * Check if cache is valid
	 */
	private isCacheValid(): boolean {
		if (!this.cache || !this.cacheMetadata) {
			return false;
		}

		const age = Date.now() - this.cacheMetadata.timestamp;
		return age < REGISTRY_CONFIG.cacheMaxAge;
	}

	/**
	 * Load cache from disk
	 */
	private async loadCache(): Promise<void> {
		try {
			const cachePath = this.getCachePath();
			const metadataPath = this.getCacheMetadataPath();

			if (!(await fs.pathExists(cachePath))) {
				console.log("[RegistryService] No cache file found");
				return;
			}

			// Load cache data
			const cacheData = await fs.readJson(cachePath);
			this.cache = cacheData;

			// Load metadata
			if (await fs.pathExists(metadataPath)) {
				this.cacheMetadata = await fs.readJson(metadataPath);
			} else {
				// Create metadata if missing
				this.cacheMetadata = {
					timestamp: Date.now(),
					version: cacheData.version,
				};
			}

			if (this.cache && this.cacheMetadata) {
				console.log(
					`[RegistryService] Loaded cache with ${this.cache.plugins.length} plugins, age: ${Math.floor((Date.now() - this.cacheMetadata.timestamp) / 1000 / 60)} minutes`,
				);
			}
		} catch (error) {
			console.error("[RegistryService] Failed to load cache:", error);
			this.cache = null;
			this.cacheMetadata = null;
		}
	}

	/**
	 * Save cache to disk
	 */
	private async saveCache(data: RegistryData, etag?: string): Promise<void> {
		try {
			await fs.ensureDir(REGISTRY_CONFIG.cacheDir);

			const cachePath = this.getCachePath();
			const metadataPath = this.getCacheMetadataPath();

			// Save data
			await fs.writeJson(cachePath, data, { spaces: "\t" });

			// Save metadata
			const metadata: CacheMetadata = {
				timestamp: Date.now(),
				etag,
				version: data.version,
			};
			await fs.writeJson(metadataPath, metadata, { spaces: "\t" });

			this.cache = data;
			this.cacheMetadata = metadata;

			console.log(`[RegistryService] Saved cache with ${data.plugins.length} plugins`);
		} catch (error) {
			console.error("[RegistryService] Failed to save cache:", error);
		}
	}

	/**
	 * Fetch registry from remote
	 */
	private async fetchRegistry(): Promise<RegistryData> {
		console.log(`[RegistryService] Fetching registry from ${REGISTRY_CONFIG.url}`);

		try {
			const headers: Record<string, string> = {
				"User-Agent": "302-AI-Studio-Plugin-Registry-Client",
			};

			// Add ETag for conditional requests
			if (this.cacheMetadata?.etag) {
				headers["If-None-Match"] = this.cacheMetadata.etag;
			}

			const response = await ky.get(REGISTRY_CONFIG.url, {
				timeout: 30000, // 30 seconds
				headers,
				retry: {
					limit: 2,
					methods: ["get"],
				},
			});

			// Check if content was modified
			if (response.status === 304) {
				console.log("[RegistryService] Registry not modified, using cache");
				if (this.cache) {
					// Update timestamp but keep existing cache
					if (this.cacheMetadata) {
						this.cacheMetadata.timestamp = Date.now();
						await fs.writeJson(this.getCacheMetadataPath(), this.cacheMetadata, {
							spaces: "\t",
						});
					}
					return this.cache;
				}
			}

			// Parse new data
			const data: RegistryData = await response.json();

			// Get ETag for next request
			const etag = response.headers.get("etag") || undefined;

			// Save to cache
			await this.saveCache(data, etag);

			console.log(`[RegistryService] Successfully fetched ${data.plugins.length} plugins`);
			return data;
		} catch (error) {
			console.error("[RegistryService] Failed to fetch registry:", error);

			// Fallback to cache if available
			if (this.cache) {
				console.log("[RegistryService] Using stale cache due to fetch error");
				return this.cache;
			}

			throw new Error(
				`Failed to load plugin registry: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Get registry data (with caching)
	 */
	private async getRegistry(): Promise<RegistryData> {
		// If already loading, wait for it
		if (this.loading) {
			return this.loading;
		}

		// Load cache from disk if not in memory
		if (!this.cache) {
			await this.loadCache();
		}

		// If cache is valid, return it
		if (this.isCacheValid()) {
			console.log("[RegistryService] Using valid cache");
			return this.cache!;
		}

		// Fetch new data
		this.loading = this.fetchRegistry();

		try {
			const data = await this.loading;
			return data;
		} finally {
			this.loading = null;
		}
	}

	/**
	 * Get all plugins from registry
	 */
	async getMarketplacePlugins(_event: IpcMainInvokeEvent): Promise<PluginMarketEntry[]> {
		console.log("[RegistryService] Getting marketplace plugins");

		try {
			const registry = await this.getRegistry();
			return registry.plugins;
		} catch (error) {
			console.error("[RegistryService] Error getting marketplace plugins:", error);
			throw error;
		}
	}

	/**
	 * Get a specific plugin from registry
	 */
	async getMarketplacePlugin(
		_event: IpcMainInvokeEvent,
		pluginId: string,
	): Promise<PluginMarketEntry | null> {
		console.log(`[RegistryService] Getting marketplace plugin: ${pluginId}`);

		try {
			const registry = await this.getRegistry();
			const plugin = registry.plugins.find((p) => p.metadata.id === pluginId);
			return plugin || null;
		} catch (error) {
			console.error(`[RegistryService] Error getting marketplace plugin ${pluginId}:`, error);
			throw error;
		}
	}

	/**
	 * Search marketplace plugins
	 */
	async searchMarketplacePlugins(
		_event: IpcMainInvokeEvent,
		query: string,
	): Promise<PluginMarketEntry[]> {
		console.log(`[RegistryService] Searching marketplace plugins: "${query}"`);

		try {
			const registry = await this.getRegistry();

			if (!query || query.trim() === "") {
				return registry.plugins;
			}

			const searchTerm = query.toLowerCase();

			const filtered = registry.plugins.filter(
				(plugin) =>
					plugin.metadata.name.toLowerCase().includes(searchTerm) ||
					plugin.metadata.description.toLowerCase().includes(searchTerm) ||
					plugin.metadata.author.toLowerCase().includes(searchTerm) ||
					plugin.metadata.tags?.some((tag) => tag.toLowerCase().includes(searchTerm)),
			);

			console.log(`[RegistryService] Found ${filtered.length} plugins matching "${query}"`);
			return filtered;
		} catch (error) {
			console.error(`[RegistryService] Error searching marketplace plugins:`, error);
			throw error;
		}
	}

	/**
	 * Get featured plugins
	 */
	async getFeaturedPlugins(_event: IpcMainInvokeEvent): Promise<PluginMarketEntry[]> {
		console.log("[RegistryService] Getting featured plugins");

		try {
			const registry = await this.getRegistry();
			const featured = registry.plugins.filter((p) => p.featured);

			console.log(`[RegistryService] Found ${featured.length} featured plugins`);
			return featured;
		} catch (error) {
			console.error("[RegistryService] Error getting featured plugins:", error);
			throw error;
		}
	}

	/**
	 * Refresh registry (force reload)
	 */
	async refreshRegistry(_event: IpcMainInvokeEvent): Promise<PluginMarketEntry[]> {
		console.log("[RegistryService] Refreshing registry (force reload)");

		try {
			// Clear cache metadata to force refresh
			this.cacheMetadata = null;

			const registry = await this.getRegistry();
			return registry.plugins;
		} catch (error) {
			console.error("[RegistryService] Error refreshing registry:", error);
			throw error;
		}
	}

	/**
	 * Clear registry cache
	 */
	async clearCache(_event: IpcMainInvokeEvent): Promise<void> {
		console.log("[RegistryService] Clearing registry cache");

		try {
			this.cache = null;
			this.cacheMetadata = null;

			if (await fs.pathExists(REGISTRY_CONFIG.cacheDir)) {
				await fs.remove(REGISTRY_CONFIG.cacheDir);
				console.log("[RegistryService] Cache cleared successfully");
			}
		} catch (error) {
			console.error("[RegistryService] Error clearing cache:", error);
			throw error;
		}
	}

	/**
	 * Get cache info
	 */
	async getCacheInfo(
		_event: IpcMainInvokeEvent,
	): Promise<{ valid: boolean; age: number; pluginCount: number; lastUpdated?: string }> {
		const valid = this.isCacheValid();
		const age = this.cacheMetadata ? Date.now() - this.cacheMetadata.timestamp : 0;
		const pluginCount = this.cache?.plugins.length || 0;
		const lastUpdated = this.cache?.lastUpdated;

		return {
			valid,
			age,
			pluginCount,
			lastUpdated,
		};
	}
}

// Singleton instance
export const registryService = new RegistryService();
