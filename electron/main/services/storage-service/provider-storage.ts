import type { MigrationConfig, ModelProvider } from "@shared/types";
import { DEFAULT_302AI_BASE_URL, get302AIBaseUrlWithoutV1 } from "@shared/utils/302ai-base-url";
import { hashApiKey } from "@shared/utils/hash";
import { isNull, isUndefined } from "es-toolkit";
import { StorageService } from "../storage-service";
import { createMigrate } from "./migration-utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
const migrations = {
	0: (state: any): ModelProvider[] => {
		// Migration from version 0 to 1: Update 302.ai API baseUrl to 302ai.com
		// Also handle object format conversion to array
		let providers: ModelProvider[];

		if (Array.isArray(state)) {
			providers = state;
		} else if (state && typeof state === "object") {
			// Convert object format {0: {...}, 1: {...}} to array
			providers = Object.values(state).filter(
				(p): p is ModelProvider => p !== null && typeof p === "object" && "apiType" in p,
			);
		} else {
			return state;
		}

		return providers.map((provider: ModelProvider) => {
			// Only update 302AI provider with old domain
			if (provider.apiType === "302ai" && provider.baseUrl?.includes("api.302.ai")) {
				return {
					...provider,
					baseUrl: provider.baseUrl.replace("api.302.ai", "api.302ai.com"),
				};
			}

			return provider;
		});
	},
};

const migrationConfig: MigrationConfig<ModelProvider[]> = {
	version: 1,
	migrate: createMigrate(migrations),
	debug: true,
};

export class ProviderStorage extends StorageService<ModelProvider[]> {
	constructor() {
		super(migrationConfig);
		this.migrationKey = "app-providers";
	}

	async validate302AIProvider(): Promise<{
		valid: boolean;
		apiKey: string;
	}> {
		const allProviders = await this.getItemInternal("app-providers");
		if (isNull(allProviders)) return { valid: false, apiKey: "" };

		// Handle both array and object formats
		const providersArray: ModelProvider[] = Array.isArray(allProviders)
			? allProviders
			: Object.values(allProviders).filter(
					(p): p is ModelProvider =>
						p !== null && typeof p === "object" && "apiType" in p,
				);

		const _302AIProvider = providersArray.find((p) => p.apiType === "302ai");
		if (isUndefined(_302AIProvider)) return { valid: false, apiKey: "" };
		if (!_302AIProvider.enabled || _302AIProvider.apiKey.trim() === "")
			return { valid: false, apiKey: "" };

		return {
			valid: true,
			apiKey: _302AIProvider.apiKey,
		};
	}

	async get302AIBaseUrl(): Promise<string> {
		const allProviders = await this.getItemInternal("app-providers");
		if (isNull(allProviders)) return DEFAULT_302AI_BASE_URL;

		const providersArray: ModelProvider[] = Array.isArray(allProviders)
			? allProviders
			: Object.values(allProviders).filter(
					(p): p is ModelProvider =>
						p !== null && typeof p === "object" && "apiType" in p,
				);

		const _302AIProvider = providersArray.find((p) => p.apiType === "302ai");
		if (isUndefined(_302AIProvider) || !_302AIProvider.baseUrl.trim()) {
			return DEFAULT_302AI_BASE_URL;
		}

		return _302AIProvider.baseUrl;
	}

	async get302AIBaseUrlWithoutV1(): Promise<string> {
		return get302AIBaseUrlWithoutV1(await this.get302AIBaseUrl());
	}

	/**
	 * Get the current 302.AI provider's API key hash
	 * Used for tracking session association with the logged-in account
	 */
	async get302AIApiKeyHash(): Promise<string | undefined> {
		const allProviders = await this.getItemInternal("app-providers");
		if (isNull(allProviders)) return undefined;

		// Handle both array and object formats
		const providersArray: ModelProvider[] = Array.isArray(allProviders)
			? allProviders
			: Object.values(allProviders).filter(
					(p): p is ModelProvider =>
						p !== null && typeof p === "object" && "apiType" in p,
				);

		const _302AIProvider = providersArray.find((p) => p.apiType === "302ai");
		if (isUndefined(_302AIProvider) || !_302AIProvider.apiKey) return undefined;

		return hashApiKey(_302AIProvider.apiKey);
	}
}

export const providerStorage = new ProviderStorage();
