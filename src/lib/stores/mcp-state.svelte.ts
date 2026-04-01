import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { McpServer } from "@shared/storage/mcp";

const persistedMcpState = new PersistedState<McpServer[]>("app-mcp-servers", []);

$effect.root(() => {
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		persistedMcpState.current;
	});
});

class McpState {
	servers = $derived(persistedMcpState.current);
	isHydrated = $derived(persistedMcpState.isHydrated);
	enabledServers = $derived(this.servers.filter((s) => s.enabled));

	getServer(id: string): McpServer | null {
		return this.servers.find((s) => s.id === id) || null;
	}

	getServerByName(name: string): McpServer | undefined {
		return this.servers.find((s) => s.name === name);
	}

	addServer(server: McpServer) {
		persistedMcpState.current = [...persistedMcpState.current, server];
	}

	updateServer(id: string, updates: Partial<McpServer>) {
		persistedMcpState.current = persistedMcpState.current.map((s) => {
			if (s.id !== id) return s;

			// Check if critical fields are being modified for account-associated servers
			let updatedServer = { ...s, ...updates, updatedAt: new Date() };

			if (s.associatedWithAccount) {
				const criticalFieldsChanged =
					(updates.url !== undefined && updates.url !== s.originalUrl) ||
					(updates.type !== undefined && updates.type !== s.originalType) ||
					(updates.command !== undefined && updates.command !== s.originalCommand);

				if (criticalFieldsChanged) {
					// Unlink from account when critical fields are modified
					updatedServer = {
						...updatedServer,
						associatedWithAccount: false,
					};
					console.log(
						`[MCP] Server "${s.name}" unlinked from account due to critical field change`,
					);
				}
			}

			return updatedServer;
		});
	}

	removeServer(id: string) {
		persistedMcpState.current = persistedMcpState.current.filter((s) => s.id !== id);
	}

	toggleEnabled(id: string): boolean {
		const server = this.getServer(id);
		if (!server) return false;

		this.updateServer(id, { enabled: !server.enabled });
		return true;
	}

	reorderServers(newOrder: McpServer[]) {
		persistedMcpState.current = [...newOrder];
	}

	getSortedServers(): McpServer[] {
		return [...this.servers].sort((a, b) => a.order - b.order);
	}

	/**
	 * Add multiple MCP servers, skipping those with names that already exist.
	 * @param servers - Array of MCP servers to add
	 * @returns Object with count of added and skipped servers
	 */
	addServersIfNotExists(servers: McpServer[]): { added: number; skipped: number } {
		let added = 0;
		let skipped = 0;

		const serversToAdd: McpServer[] = [];

		for (const server of servers) {
			const existingServer = this.getServerByName(server.name);
			if (existingServer) {
				skipped++;
				console.log(`[MCP] Skipped server "${server.name}" - already exists`);
			} else {
				serversToAdd.push(server);
				added++;
			}
		}

		if (serversToAdd.length > 0) {
			persistedMcpState.current = [...persistedMcpState.current, ...serversToAdd];
			console.log(`[MCP] Added ${added} new servers`);
		}

		return { added, skipped };
	}

	/**
	 * Get all MCP servers that are associated with the logged-in account
	 */
	getAssociatedServers(): McpServer[] {
		return this.servers.filter((s) => s.associatedWithAccount === true);
	}

	/**
	 * Remove all MCP servers that are associated with the account
	 * @returns Number of servers removed
	 */
	removeAssociatedServers(): number {
		const before = persistedMcpState.current.length;
		persistedMcpState.current = persistedMcpState.current.filter(
			(s) => s.associatedWithAccount !== true,
		);
		const removed = before - persistedMcpState.current.length;
		if (removed > 0) {
			console.log(`[MCP] Removed ${removed} account-associated servers`);
		}
		return removed;
	}

	getServerUrlsByIds(ids: string[]): string[] {
		return this.servers
			.filter((server) => ids.includes(server.id))
			.map((server) => server.url)
			.filter((url) => url !== null);
	}

	getMCPInfosByIds(ids: string[]): { url: string; name: string }[] {
		return this.servers
			.filter((server) => server.id && ids.includes(server.id))
			.map((server) => ({ url: server.url, name: server.name }))
			.filter((info): info is { url: string; name: string } => info.url !== null);
	}
	/**
	 * Filter server IDs to only include streamableHTTP type servers
	 * @param ids - Array of server IDs to filter
	 * @returns Object with compatible IDs and filtered out server names
	 */
	filterStreamableHTTPServers(ids: string[]): {
		compatibleIds: string[];
		filteredNames: string[];
	} {
		const compatibleIds: string[] = [];
		const filteredNames: string[] = [];

		for (const id of ids) {
			const server = this.getServer(id);
			if (server) {
				if (server.type === "streamableHTTP") {
					compatibleIds.push(id);
				} else {
					filteredNames.push(server.name);
				}
			}
		}

		return { compatibleIds, filteredNames };
	}
}

export const mcpState = new McpState();
