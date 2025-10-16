<script lang="ts" module>
	import type { McpServerType } from "@shared/storage/mcp";

	export interface Props {
		open: boolean;
		onClose: () => void;
		onImport: (data: ImportData) => void;
	}

	export interface ImportData {
		name: string;
		type: McpServerType;
		url?: string;
		command?: string;
		env?: Record<string, string>;
	}
</script>

<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Textarea } from "$lib/components/ui/textarea/index.js";
	import * as m from "$lib/paraglide/messages.js";
	import { toast } from "svelte-sonner";

	let { open = $bindable(), onClose, onImport }: Props = $props();

	let jsonInput = $state("");
	let isProcessing = $state(false);

	function parseImportData(jsonText: string): ImportData[] {
		try {
			const parsed = JSON.parse(jsonText);

			if (!parsed.mcpServers || typeof parsed.mcpServers !== "object") {
				throw new Error(m.mcp_import_error_invalid());
			}

			const servers: ImportData[] = [];

			for (const [serverName, config] of Object.entries(parsed.mcpServers)) {
				if (typeof config !== "object" || config === null) {
					continue;
				}

				const serverConfig = config as Record<string, unknown>;

				if (serverConfig.url) {
					const url = serverConfig.url as string;
					let type: McpServerType = "streamableHTTP";

					if (url.includes("/sse/")) {
						type = "sse";
					} else if (url.includes("/mcp/")) {
						type = "streamableHTTP";
					}

					servers.push({
						name: serverName,
						type,
						url,
					});
				} else if (serverConfig.command) {
					const cmd = serverConfig.command as string;
					const args = Array.isArray(serverConfig.args) ? (serverConfig.args as string[]) : [];
					const combinedCommand = args.length > 0 ? `${cmd} ${args.join(" ")}` : cmd;

					servers.push({
						name: serverName,
						type: "stdio",
						command: combinedCommand,
						env: (serverConfig.env as Record<string, string>) || {},
					});
				}
			}

			return servers;
		} catch (error) {
			throw new Error(
				m.mcp_import_error_parse({
					error: error instanceof Error ? error.message : m.mcp_import_error_unknown(),
				}),
			);
		}
	}

	async function handleImport() {
		if (!jsonInput.trim()) {
			toast.error(m.mcp_import_error_empty());
			return;
		}

		isProcessing = true;

		try {
			const importedServers = parseImportData(jsonInput);

			if (importedServers.length === 0) {
				toast.error(m.mcp_import_error_no_servers());
				return;
			}

			const serverData = importedServers[0];
			onImport(serverData);

			toast.success(m.mcp_import_success({ count: importedServers.length.toString() }));
			handleClose();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : m.mcp_import_error_unknown();
			toast.error(m.mcp_import_error({ error: errorMessage }));
		} finally {
			isProcessing = false;
		}
	}

	function handleClose() {
		jsonInput = "";
		onClose();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>{m.mcp_import_title()}</Dialog.Title>
		</Dialog.Header>

		<div class="space-y-4">
			<div class="flex flex-col gap-2">
				<Label for="jsonInput">{m.mcp_import_json_label()}</Label>
				<Textarea
					id="jsonInput"
					bind:value={jsonInput}
					placeholder={m.mcp_import_json_placeholder()}
					class="min-h-48 resize-none rounded-settings-item bg-settings-item-bg font-mono text-sm"
				/>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={handleClose}>{m.mcp_cancel()}</Button>
			<Button onclick={handleImport} disabled={!jsonInput.trim() || isProcessing}>
				{isProcessing ? m.mcp_import_processing() : m.mcp_import_button()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
