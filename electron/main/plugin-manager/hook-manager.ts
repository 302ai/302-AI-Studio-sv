/**
 * Hook Manager
 *
 * Manages hook registration and execution for the plugin system
 */

import type { HookHandler, HookOptions } from "@302ai/studio-plugin-sdk";
import type { IHookManager } from "./types";
import { createLogger } from "@shared/logger";

const logger = createLogger("plugin");

interface RegisteredHook<T = unknown> {
	pluginId: string;
	handler: HookHandler<T>;
	options?: HookOptions;
}

/**
 * Hook manager implementation
 * Manages hook registration and provides execution pipeline
 */
export class HookManager implements IHookManager {
	private hooks: Map<string, RegisteredHook[]> = new Map();

	/**
	 * Register a hook handler
	 */
	register<T = unknown>(
		hookName: string,
		pluginId: string,
		handler: HookHandler<T>,
		options?: HookOptions,
	): void {
		if (!this.hooks.has(hookName)) {
			this.hooks.set(hookName, []);
		}

		const handlers = this.hooks.get(hookName)!;

		// Check if this plugin already registered this hook
		const existing = handlers.findIndex((h) => h.pluginId === pluginId);
		if (existing !== -1) {
			logger.warn(
				`[HookManager] Plugin ${pluginId} already registered hook ${hookName}, replacing...`,
			);
			handlers.splice(existing, 1);
		}

		// Insert hook in priority order (higher priority first)
		const priority = options?.priority ?? 0;
		const insertIndex = handlers.findIndex((h) => (h.options?.priority ?? 0) < priority);

		if (insertIndex === -1) {
			handlers.push({ pluginId, handler, options } as RegisteredHook);
		} else {
			handlers.splice(insertIndex, 0, { pluginId, handler, options } as RegisteredHook);
		}

		logger.info(
			`[HookManager] Registered hook ${hookName} for plugin ${pluginId} (priority: ${priority})`,
		);
	}

	/**
	 * Unregister a hook handler
	 */
	unregister(hookName: string, pluginId: string): void {
		const handlers = this.hooks.get(hookName);
		if (!handlers) {
			logger.warn(`[HookManager] No handlers registered for hook ${hookName}`);
			return;
		}

		const index = handlers.findIndex((h) => h.pluginId === pluginId);
		if (index === -1) {
			logger.warn(`[HookManager] Plugin ${pluginId} has no handler for hook ${hookName}`);
			return;
		}

		handlers.splice(index, 1);
		logger.info(`[HookManager] Unregistered hook ${hookName} for plugin ${pluginId}`);

		// Clean up empty hook arrays
		if (handlers.length === 0) {
			this.hooks.delete(hookName);
		}
	}

	/**
	 * Execute hook handlers in sequence
	 */
	async execute<T = unknown>(hookName: string, context: T, options?: HookOptions): Promise<T> {
		const handlers = this.hooks.get(hookName);
		if (!handlers || handlers.length === 0) {
			// No handlers registered, return context as-is
			return context;
		}

		logger.info(`[HookManager] Executing hook ${hookName} (${handlers.length} handlers)`);

		let result = context;
		const stopOnError = options?.stopOnError ?? false;
		const timeout = options?.timeout ?? 30000; // 30 second default timeout

		for (const { pluginId, handler } of handlers) {
			try {
				// Create a timeout promise
				const timeoutPromise = new Promise<never>((_, reject) => {
					setTimeout(() => {
						reject(new Error(`Hook ${hookName} in plugin ${pluginId} timed out`));
					}, timeout);
				});

				// Execute handler with timeout
				const handlerPromise = Promise.resolve(handler(result));
				result = (await Promise.race([handlerPromise, timeoutPromise])) as T;

				// Check if we should stop execution
				if (result && typeof result === "object" && "stop" in result && result.stop === true) {
					logger.info(`[HookManager] Hook ${hookName} in plugin ${pluginId} requested stop`);
					break;
				}
			} catch (error) {
				logger.error(
					`[HookManager] Error executing hook ${hookName} in plugin ${pluginId}:`,
					error,
				);

				if (stopOnError) {
					throw error;
				}

				// Continue with next handler
			}
		}

		return result;
	}

	/**
	 * Get registered hooks for a hook name
	 */
	getHooks(
		hookName: string,
	): Array<{ pluginId: string; handler: HookHandler; options?: HookOptions }> {
		const handlers = this.hooks.get(hookName);
		if (!handlers) {
			return [];
		}

		return handlers.map((h) => ({
			pluginId: h.pluginId,
			handler: h.handler,
			options: h.options,
		}));
	}

	/**
	 * Check if a hook has handlers
	 */
	hasHook(hookName: string): boolean {
		const handlers = this.hooks.get(hookName);
		return handlers !== undefined && handlers.length > 0;
	}

	/**
	 * Get all hook names
	 */
	getHookNames(): string[] {
		return Array.from(this.hooks.keys());
	}

	/**
	 * Get hook count for a specific hook name
	 */
	getHookCount(hookName: string): number {
		const handlers = this.hooks.get(hookName);
		return handlers?.length ?? 0;
	}

	/**
	 * Clear all hooks
	 */
	clear(): void {
		this.hooks.clear();
		logger.info("[HookManager] Cleared all hooks");
	}

	/**
	 * Clear hooks for a specific plugin
	 */
	clearPlugin(pluginId: string): void {
		for (const [hookName, handlers] of this.hooks.entries()) {
			const filtered = handlers.filter((h) => h.pluginId !== pluginId);

			if (filtered.length === 0) {
				this.hooks.delete(hookName);
			} else if (filtered.length !== handlers.length) {
				this.hooks.set(hookName, filtered);
			}
		}

		logger.info(`[HookManager] Cleared hooks for plugin ${pluginId}`);
	}
}

// Singleton instance
export const hookManager = new HookManager();
