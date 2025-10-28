/**
 * Provider Plugin Helper
 *
 * Helper functions for executing provider plugin hooks in the main process
 */

import type { Model, ModelProvider } from "@shared/types";
import { hookManager } from "../plugin-manager/hook-manager";
import { pluginRegistry } from "../plugin-manager/plugin-registry";

/**
 * Execute provider authentication hook
 */
export async function executeAuthenticationHook(
	provider: ModelProvider,
): Promise<{ success: boolean; error?: string }> {
	try {
		// Get the provider plugin
		const plugins = Array.from(pluginRegistry.getAll().values());
		const providerPlugin = plugins.find((p) => {
			if (p.plugin.metadata.type !== "provider") return false;
			if (!p.instance.getProviderDefinition) return false;

			try {
				const definition = p.instance.getProviderDefinition();
				const resolvedDefinition = definition instanceof Promise ? null : definition;
				return resolvedDefinition && resolvedDefinition.id === provider.id;
			} catch {
				return false;
			}
		});

		if (!providerPlugin) {
			// No plugin registered for this provider, use default behavior
			return { success: true };
		}

		// Execute authentication hook
		const result = await providerPlugin.instance.onAuthenticate({
			provider,
			method: "apikey",
		});

		return result;
	} catch (error) {
		console.error("[ProviderPluginHelper] Authentication hook failed:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Authentication failed",
		};
	}
}

/**
 * Execute fetch models hook for a provider
 */
export async function executeFetchModelsHook(provider: ModelProvider): Promise<Model[]> {
	try {
		// Get the provider plugin
		const plugins = Array.from(pluginRegistry.getAll().values());
		const providerPlugin = plugins.find((p) => {
			if (p.plugin.metadata.type !== "provider") return false;
			if (!p.instance.getProviderDefinition) return false;

			try {
				const definition = p.instance.getProviderDefinition();
				const resolvedDefinition = definition instanceof Promise ? null : definition;
				return resolvedDefinition && resolvedDefinition.id === provider.id;
			} catch {
				return false;
			}
		});

		if (!providerPlugin) {
			console.warn(
				`[ProviderPluginHelper] No plugin found for provider ${provider.id}, using default behavior`,
			);
			return [];
		}

		// Execute fetch models hook
		console.log(`[ProviderPluginHelper] Executing fetch models hook for ${provider.id}`);
		const models = await providerPlugin.instance.onFetchModels(provider);

		console.log(`[ProviderPluginHelper] Fetched ${models.length} models for ${provider.id}`);
		return models;
	} catch (error) {
		console.error("[ProviderPluginHelper] Fetch models hook failed:", error);
		throw error;
	}
}

/**
 * Execute before send message hook
 */
export async function executeBeforeSendMessageHook(context: {
	messages: unknown[];
	userMessage: unknown;
	model: Model;
	provider: ModelProvider;
	parameters: Record<string, unknown>;
	options: Record<string, unknown>;
}): Promise<typeof context> {
	try {
		// Execute hook through hook manager
		const result = await hookManager.execute("provider:before-send-message", context);
		return result;
	} catch (error) {
		console.error("[ProviderPluginHelper] Before send message hook failed:", error);
		// Return original context on error
		return context;
	}
}

/**
 * Execute after send message hook
 */
export async function executeAfterSendMessageHook(
	context: {
		messages: unknown[];
		userMessage: unknown;
		model: Model;
		provider: ModelProvider;
		parameters: Record<string, unknown>;
		options: Record<string, unknown>;
	},
	response: {
		message: unknown;
		usage?: {
			promptTokens: number;
			completionTokens: number;
			totalTokens: number;
		};
		model: string;
		finishReason: string;
		metadata?: Record<string, unknown>;
	},
): Promise<void> {
	try {
		// Execute hook through hook manager
		await hookManager.execute("provider:after-send-message", { context, response });
	} catch (error) {
		console.error("[ProviderPluginHelper] After send message hook failed:", error);
		// Continue execution even if hook fails
	}
}

/**
 * Execute stream chunk hook
 */
export async function executeStreamChunkHook(chunk: {
	type: string;
	text?: string;
	toolCall?: unknown;
	reasoning?: string;
	error?: Error;
	metadata?: Record<string, unknown>;
}): Promise<typeof chunk> {
	try {
		// Execute hook through hook manager
		const result = await hookManager.execute("provider:stream-chunk", chunk);
		return result;
	} catch (error) {
		console.error("[ProviderPluginHelper] Stream chunk hook failed:", error);
		// Return original chunk on error
		return chunk;
	}
}

/**
 * Execute error hook
 */
export async function executeErrorHook(
	error: Error,
	context: {
		source: string;
		provider?: ModelProvider;
		model?: Model;
		metadata?: Record<string, unknown>;
	},
): Promise<{
	handled: boolean;
	retry?: boolean;
	retryDelay?: number;
	message?: string;
}> {
	try {
		// Execute hook through hook manager
		const result = await hookManager.execute("provider:error", {
			error,
			...context,
		});

		return result && typeof result === "object" && "handled" in result
			? (result as { handled: boolean; retry?: boolean; retryDelay?: number; message?: string })
			: { handled: false };
	} catch (hookError) {
		console.error("[ProviderPluginHelper] Error hook failed:", hookError);
		// Return not handled on error
		return { handled: false };
	}
}

/**
 * Get all registered provider plugins
 */
export function getRegisteredProviderPlugins(): Array<{
	pluginId: string;
	providerId: string;
	providerName: string;
}> {
	const plugins = Array.from(pluginRegistry.getAll().values());

	return plugins
		.filter((p) => p.plugin.metadata.type === "provider")
		.map((p) => {
			try {
				const definition = p.instance.getProviderDefinition();
				const resolvedDefinition = definition instanceof Promise ? null : definition;

				if (!resolvedDefinition) return null;

				return {
					pluginId: p.plugin.metadata.id,
					providerId: resolvedDefinition.id || "unknown",
					providerName: resolvedDefinition.name || p.plugin.metadata.name,
				};
			} catch (error) {
				console.error(
					`[ProviderPluginHelper] Failed to get definition for plugin ${p.plugin.metadata.id}:`,
					error,
				);
				return null;
			}
		})
		.filter((p): p is NonNullable<typeof p> => p !== null);
}

/**
 * Check if a provider has a registered plugin
 */
export function hasProviderPlugin(providerId: string): boolean {
	const providers = getRegisteredProviderPlugins();
	return providers.some((p) => p.providerId === providerId);
}
