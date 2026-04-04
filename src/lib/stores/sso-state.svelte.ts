import { buildMcpServerUrl, fetch302McpServers } from "$lib/api/302-mcp-servers";
import { createLogger } from "@shared/logger";

const logger = createLogger("state");
import type { SsoApikeyDialogAction } from "$lib/components/buss/sso-apikey-dialog";
import { m } from "$lib/paraglide/messages.js";
import { open302SsoLogin } from "$lib/utils/sso";
import type { McpServer } from "@shared/storage/mcp";
import { nanoid } from "nanoid";
import { toast } from "svelte-sonner";
import { generalSettings } from "./general-settings.state.svelte";
import { mcpState } from "./mcp-state.svelte";
import { providerState } from "./provider-state.svelte";
import { userState } from "./user-state.svelte";

class SsoStateManager {
	isLoading = $state(false);
	hasError = $state(false);
	isSuccess = $state(false);

	// API Key conflict dialog state
	showApiKeyConflictDialog = $state(false);
	pendingApiKey = $state<string | null>(null);

	async login() {
		if (this.isLoading) return;

		this.isLoading = true;
		this.hasError = false;
		this.isSuccess = false;

		try {
			const result = await open302SsoLogin();

			if (result.success && result.apiKey) {
				// Set the API key as token with Basic prefix
				const token = result.apiKey.startsWith("Basic ")
					? result.apiKey
					: `Basic ${result.apiKey}`;
				userState.setToken(token);

				// Extract raw API key
				let rawApiKey = result.apiKey;
				if (rawApiKey.startsWith("Basic ")) {
					rawApiKey = rawApiKey.slice(6).trim();
				}

				// Check 302.AI provider status
				const provider = providerState.getProvider("302AI");

				if (provider && provider.apiKey && provider.apiKey.trim() !== "") {
					// Provider already has an API key - show conflict dialog
					this.pendingApiKey = rawApiKey;
					this.showApiKeyConflictDialog = true;
					// Don't proceed with login flow yet - wait for user selection
					// The handleApiKeyConflict method will continue the flow
				} else if (provider) {
					// Provider exists but has no API key - auto-fill it
					await providerState.updateProvider("302AI", { apiKey: rawApiKey });
					// Store the SSO API key for association tracking
					userState.setSsoApiKey(rawApiKey);
					await providerState.fetchModelsForProvider(provider);
					await this.completeLoginFlow();
				} else {
					// No provider found - just complete login
					await this.completeLoginFlow();
				}
			} else {
				this.hasError = true;
				if (
					result.error &&
					!result.error.includes("closed") &&
					!result.error.includes("timeout")
				) {
					toast.error(result.error);
				}
				this.isLoading = false;
			}
		} catch (_error) {
			this.hasError = true;
			toast.error(m.sso_error());
			this.isLoading = false;
		}
	}

	/**
	 * Handle the user's selection from the API key conflict dialog
	 */
	async handleApiKeyConflict(action: SsoApikeyDialogAction) {
		this.showApiKeyConflictDialog = false;

		const newApiKey = this.pendingApiKey;
		this.pendingApiKey = null;

		if (!newApiKey) {
			this.isLoading = false;
			return;
		}

		const provider = providerState.getProvider("302AI");
		if (!provider) {
			this.isLoading = false;
			return;
		}

		try {
			switch (action) {
				case "override":
					// Override: Replace the existing API key with the new one
					await providerState.updateProvider("302AI", { apiKey: newApiKey });
					// Store the SSO API key for association tracking
					userState.setSsoApiKey(newApiKey);
					await providerState.fetchModelsForProvider(provider);
					break;

				case "keep":
					// Keep: Keep the original API key, but refresh models with it
					// Don't update ssoApiKey - the user chose to keep the old key
					await providerState.fetchModelsForProvider(provider);
					break;

				case "backup": {
					// Backup: Create a backup of the original provider, then override
					const suffix =
						generalSettings.language === "zh"
							? m.sso_apikey_provider_backup_suffix()
							: m.sso_apikey_provider_backup_suffix();
					providerState.createProviderBackup("302AI", suffix);

					// Now update the original provider with the new API key
					await providerState.updateProvider("302AI", { apiKey: newApiKey });
					// Store the SSO API key for association tracking
					userState.setSsoApiKey(newApiKey);
					await providerState.fetchModelsForProvider(provider);
					break;
				}
			}

			await this.completeLoginFlow();
		} catch (error) {
			logger.error("Failed to handle API key conflict:", error);
			this.hasError = true;
			toast.error(m.sso_error());
			this.isLoading = false;
		}
	}

	/**
	 * Complete the login flow after handling provider updates
	 */
	private async completeLoginFlow() {
		try {
			// Fetch user info
			const fetchResult = await userState.fetchUserInfo();
			if (fetchResult.success) {
				this.isSuccess = true;
				toast.success(m.login_success());

				// Set default model for 302AI provider if needed
				// This uses the shared logic with manual API key addition
				const provider302AI = providerState.getProvider("302AI");
				if (provider302AI) {
					await providerState.applyDefaultModelIfNeeded(provider302AI);
				}

				// Fetch and import MCP servers from 302.AI (silently, don't block login)
				this.fetchAndImportMcpServers();

				// Reset success state after 3 seconds
				setTimeout(() => {
					this.isSuccess = false;
				}, 3000);
			} else {
				this.hasError = true;
				toast.error(m.sso_error());
			}
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Fetch MCP servers from 302.AI and import them locally
	 * This runs silently and doesn't affect the login flow
	 */
	private async fetchAndImportMcpServers() {
		const token = userState.token;
		if (!token) {
			logger.info("No token available, skipping MCP server fetch");
			return;
		}

		try {
			const servers302 = await fetch302McpServers(token);
			if (servers302.length === 0) {
				logger.info("No MCP servers found from 302.AI");
				return;
			}

			// Convert to local McpServer format
			const now = new Date();
			const maxOrder = mcpState.servers.reduce((max, s) => Math.max(max, s.order), 0);

			const mcpServers: McpServer[] = servers302.map((server, index) => {
				const serverUrl = buildMcpServerUrl(server.proxyId);
				return {
					id: nanoid(),
					name: server.name,
					description:
						server.displayTools.length > 0 ? server.displayTools.join(", ") : "",
					type: "streamableHTTP" as const,
					url: serverUrl,
					command: null,
					icon: "🔧",
					enabled: true,
					order: maxOrder + index + 1,
					createdAt: now,
					updatedAt: now,
					// Association tracking fields
					associatedWithAccount: true,
					originalUrl: serverUrl,
					originalType: "streamableHTTP" as const,
					originalCommand: null,
				};
			});

			// Add servers that don't already exist (by name)
			const result = mcpState.addServersIfNotExists(mcpServers);
			logger.info(
				`[302 MCP] Import complete: ${result.added} added, ${result.skipped} skipped (already exist)`,
			);
		} catch (error) {
			// Silently log errors - don't affect login flow
			logger.error("Failed to fetch/import MCP servers:", error);
		}
	}

	/**
	 * Cancel the API key conflict dialog
	 */
	cancelApiKeyConflict() {
		this.showApiKeyConflictDialog = false;
		this.pendingApiKey = null;
		this.isLoading = false;
	}

	reset() {
		this.isLoading = false;
		this.hasError = false;
		this.isSuccess = false;
		this.showApiKeyConflictDialog = false;
		this.pendingApiKey = null;
	}
}

export const ssoState = new SsoStateManager();
