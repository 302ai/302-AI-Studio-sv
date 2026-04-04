<script lang="ts">
	import { goto } from "$app/navigation";
	import EmojiPicker from "$lib/components/buss/emoji-picker/emoji-picker.svelte";
	import StaticCodeBlock from "$lib/components/buss/markdown/static-code-block.svelte";
	import AdvancedSwitchItem from "$lib/components/buss/settings/advanced-switch-item.svelte";
	import KeyValueList from "$lib/components/buss/settings/key-value-list.svelte";
	import SegButton from "$lib/components/buss/settings/seg-button.svelte";
	import SettingInputField from "$lib/components/buss/settings/setting-input-field.svelte";
	import SettingSelectField from "$lib/components/buss/settings/setting-select-field.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Collapsible from "$lib/components/ui/collapsible/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import * as m from "$lib/paraglide/messages.js";
	import { mcpState } from "$lib/stores/mcp-state.svelte";
	import {
		ChevronDown,
		ChevronLeft,
		Hammer,
		LayoutGrid,
		NotepadText,
		RefreshCw,
		Trash2,
	} from "@lucide/svelte";
	import type { McpServerType } from "@shared/storage/mcp";
	import { nanoid } from "nanoid";
	import { toast } from "svelte-sonner";
	import { createLogger } from "@shared/logger";

	const logger = createLogger("ui");

	interface McpTool {
		name: string;
		description?: string;
		inputSchema?: Record<string, unknown>;
	}

	interface KeyValuePair {
		key: string;
		value: string;
		id: string;
	}

	interface Props {
		mode: "add" | "edit";
		serverId?: string;
		onBack?: () => void;
		onSaveSuccess?: (serverId: string) => void;
	}

	let { mode, serverId, onBack, onSaveSuccess }: Props = $props();

	const server = $derived(mode === "edit" && serverId ? mcpState.getServer(serverId) : null);

	let name = $state("");
	let type = $state<McpServerType>("streamableHTTP");
	let icon = $state("🔧");
	let url = $state("");
	let command = $state("");
	let timeout = $state(0);
	let headers = $state<KeyValuePair[]>([]);
	let envVars = $state<KeyValuePair[]>([]);
	let autoUseTools = $state(true);
	let keepConnection = $state(false);

	let isSaving = $state(false);
	let showDeleteDialog = $state(false);
	let isAdvancedOpen = $state(false);
	let isInitialLoad = $state(true);

	// MCP Resources Tab
	type ResourceTab = "tools" | "prompts" | "resources";
	let selectedResourceTab = $state<ResourceTab>("tools");
	let isLoadingTools = $state(false);
	let tools = $state<McpTool[]>([]);
	let selectedTool = $state<McpTool | null>(null);
	let showToolDialog = $state(false);

	const resourceTabOptions = [
		{ key: "tools", label: m.mcp_tools(), icon: Hammer, iconSize: 14 },
		{ key: "prompts", label: m.mcp_prompts(), icon: NotepadText, iconSize: 14 },
		{ key: "resources", label: m.mcp_resources(), icon: LayoutGrid, iconSize: 14 },
	];

	$effect(() => {
		if (mode === "edit" && server) {
			name = server.name;
			type = server.type;
			icon = server.icon || "🔧";
			url = server.url || "";
			command = server.command || "";
			timeout = server.advancedSettings?.timeout || 0;

			const headersObj = server.advancedSettings?.customHeaders;
			headers = headersObj
				? Object.entries(headersObj).map(([key, value], index) => ({
						key,
						value: String(value),
						id: `header-${index}`,
					}))
				: [];

			const envVarsObj = server.advancedSettings?.customEnvVars;
			envVars = envVarsObj
				? Object.entries(envVarsObj).map(([key, value], index) => ({
						key,
						value: String(value),
						id: `env-${index}`,
					}))
				: [];

			autoUseTools = server.advancedSettings?.autoUseTool ?? true;
			keepConnection = server.advancedSettings?.keepLongTaskConnection ?? false;

			if (isInitialLoad) {
				handleRefreshTools();
				isInitialLoad = false;
			}
		}
	});

	const typeOptions = [
		{ value: "streamableHTTP", label: "Streamable HTTP" },
		{ value: "stdio", label: "STDIO" },
		{ value: "sse", label: "SSE" },
	];

	function handleBack() {
		if (onBack) {
			onBack();
		} else {
			goto("/settings/mcp-settings");
		}
	}

	function addHeader() {
		headers = [...headers, { key: "", value: "", id: nanoid() }];
	}

	function removeHeader(id: string) {
		headers = headers.filter((h) => h.id !== id);
	}

	function addEnvVar() {
		envVars = [...envVars, { key: "", value: "", id: nanoid() }];
	}

	function removeEnvVar(id: string) {
		envVars = envVars.filter((e) => e.id !== id);
	}

	async function handleSave() {
		if (!name.trim()) {
			toast.error(m.mcp_error_name_required());
			return;
		}

		if (type === "stdio") {
			if (!command.trim()) {
				toast.error(m.mcp_error_command_required());
				return;
			}
		} else {
			if (!url.trim()) {
				toast.error(m.mcp_error_url_required());
				return;
			}
		}

		isSaving = true;

		try {
			const validHeaders = headers.filter((h) => h.key.trim() && h.value.trim());
			const validEnvVars = envVars.filter((e) => e.key.trim() && e.value.trim());

			const serverData = {
				name,
				type,
				url: type === "stdio" ? null : url,
				command: type === "stdio" ? command : null,
				icon,
				advancedSettings: {
					timeout: timeout || undefined,
					customHeaders: validHeaders.length
						? Object.fromEntries(validHeaders.map((h) => [h.key, h.value]))
						: undefined,
					customEnvVars: validEnvVars.length
						? Object.fromEntries(validEnvVars.map((e) => [e.key, e.value]))
						: undefined,
					autoUseTool: autoUseTools,
					keepLongTaskConnection: keepConnection,
				},
			};

			// Validate server configuration by trying to fetch tools
			const tempServerId = mode === "edit" && serverId ? serverId : nanoid();
			const testServerData = JSON.parse(
				JSON.stringify({
					id: tempServerId,
					name: serverData.name,
					description: "",
					type: serverData.type,
					url: serverData.url,
					command: serverData.command,
					icon: serverData.icon,
					enabled: true,
					order: 0,
					createdAt: new Date(),
					updatedAt: new Date(),
					advancedSettings: serverData.advancedSettings,
				}),
			);

			const result = await window.electronAPI.mcpService.getToolsFromServer(testServerData);
			if (!result.isOk) {
				toast.error(result.error || m.mcp_error_connection());
				return;
			}

			if (mode === "add") {
				const now = new Date();
				mcpState.addServer({
					id: tempServerId,
					...serverData,
					description: "",
					enabled: true,
					order: mcpState.servers.length,
					createdAt: now,
					updatedAt: now,
				});
				toast.success(m.mcp_success_save());
			} else if (mode === "edit" && serverId) {
				mcpState.updateServer(serverId, serverData);
				toast.success(m.mcp_success_update());
			}

			if (onSaveSuccess) {
				onSaveSuccess(tempServerId);
			} else {
				goto("/settings/mcp-settings");
			}
		} catch (error) {
			logger.error("Failed to save MCP server:", error);
			toast.error(mode === "add" ? m.mcp_error_save() : m.mcp_error_update());
		} finally {
			isSaving = false;
		}
	}

	function handleDelete() {
		showDeleteDialog = true;
	}

	function confirmDelete() {
		if (mode === "edit" && serverId) {
			mcpState.removeServer(serverId);
			toast.success(m.mcp_success_delete());
			if (onBack) {
				onBack();
			} else {
				goto("/settings/mcp-settings");
			}
		}
	}

	async function handleRefreshTools() {
		if (!server) return;

		isLoadingTools = true;
		try {
			// Use current form values instead of stored server data
			const validHeaders = headers.filter((h) => h.key.trim() && h.value.trim());
			const validEnvVars = envVars.filter((e) => e.key.trim() && e.value.trim());

			const serverData = JSON.parse(
				JSON.stringify({
					id: server.id,
					name: name,
					description: server.description,
					type: type,
					url: type === "stdio" ? null : url,
					command: type === "stdio" ? command : null,
					icon: icon,
					enabled: server.enabled,
					order: server.order,
					createdAt: server.createdAt,
					updatedAt: server.updatedAt,
					advancedSettings: {
						timeout: timeout || undefined,
						customHeaders: validHeaders.length
							? Object.fromEntries(validHeaders.map((h) => [h.key, h.value]))
							: undefined,
						customEnvVars: validEnvVars.length
							? Object.fromEntries(validEnvVars.map((e) => [e.key, e.value]))
							: undefined,
						autoUseTool: autoUseTools,
						keepLongTaskConnection: keepConnection,
					},
				}),
			);

			const result = await window.electronAPI.mcpService.getToolsFromServer(serverData);
			if (result.isOk && result.tools) {
				tools = result.tools;
				toast.success(m.mcp_success_update());
			} else {
				toast.error(result.error || m.mcp_error_update());
			}
		} catch (error) {
			logger.error("Failed to fetch tools:", error);
			toast.error(m.mcp_error_update());
		} finally {
			isLoadingTools = false;
		}
	}

	function handleToolClick(tool: McpTool) {
		selectedTool = tool;
		showToolDialog = true;
	}
</script>

{#if mode === "edit" && !server}
	<div class="flex h-full items-center justify-center">
		<p class="text-muted-foreground">{m.mcp_server_not_found()}</p>
	</div>
{:else}
	<div class="flex h-full w-full flex-col gap-6 pb-6">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<Button variant="outline" size="sm" onclick={handleBack}>
				<ChevronLeft class="h-4 w-4" />
				{m.mcp_back()}
			</Button>

			<div class="flex gap-2">
				{#if mode === "edit"}
					<Button
						variant="outline"
						size="sm"
						class="text-[#D82525]"
						onclick={handleDelete}
					>
						<Trash2 class="h-4 w-4" />
						{m.mcp_delete()}
					</Button>
				{/if}
				<Button size="sm" onclick={handleSave} disabled={isSaving}>
					{isSaving ? m.mcp_saving() : m.mcp_save()}
				</Button>
			</div>
		</div>

		<!-- Form -->
		<div class="flex flex-col gap-4">
			<!-- 名称 -->
			<SettingInputField
				id="name"
				label={m.mcp_name()}
				required
				bind:value={name}
				placeholder={m.mcp_name_placeholder()}
			/>

			<!-- 类型 -->
			<SettingSelectField
				label={m.mcp_type()}
				name="type"
				bind:value={type}
				options={typeOptions}
			/>

			<!-- 图标 -->
			<div class="flex flex-col items-start gap-2">
				<label for="icon" class="text-sm font-medium">{m.mcp_icon()}</label>
				<EmojiPicker bind:value={icon} />
			</div>

			<!-- URL - 只在非 stdio 时显示 -->
			{#if type !== "stdio"}
				<SettingInputField
					id="url"
					label={m.mcp_url()}
					required
					bind:value={url}
					placeholder={m.mcp_url_placeholder()}
				/>
			{/if}

			<!-- Command - 只在 stdio 时显示 -->
			{#if type === "stdio"}
				<SettingInputField
					id="command"
					label={m.mcp_command()}
					required
					bind:value={command}
					placeholder={m.mcp_command_placeholder()}
				/>
			{/if}

			<!-- 高级设置 -->
			<Collapsible.Root bind:open={isAdvancedOpen} class="bg-settings-item-bg rounded-lg">
				<Collapsible.Trigger class="flex w-full items-center justify-between px-3 py-2">
					<span class="font-medium">{m.mcp_advanced_settings()}</span>
					<ChevronDown
						class="h-4 w-4 transition-transform duration-200 {isAdvancedOpen
							? 'rotate-180'
							: ''}"
					/>
				</Collapsible.Trigger>
				<Collapsible.Content class="px-3 pb-4 pt-2">
					<div class="space-y-4">
						<!-- 超时 -->
						<SettingInputField
							id="timeout"
							type="number"
							label={m.mcp_timeout()}
							bind:value={timeout}
							placeholder={m.mcp_timeout_placeholder()}
							inputClass="!bg-white dark:!bg-[#121212]"
						/>

						<!-- 自定义请求头 - 只在 sse 和 streamableHTTP 时显示 -->
						{#if type === "sse" || type === "streamableHTTP"}
							<KeyValueList
								label={m.mcp_custom_headers()}
								bind:items={headers}
								onAdd={addHeader}
								onRemove={removeHeader}
							/>
						{/if}

						<!-- 环境变量 - 只在 stdio 时显示 -->
						{#if type === "stdio"}
							<KeyValueList
								label={m.mcp_env_vars()}
								bind:items={envVars}
								onAdd={addEnvVar}
								onRemove={removeEnvVar}
							/>
						{/if}

						<!-- 其他设置 -->
						<div class="flex flex-col gap-2">
							<AdvancedSwitchItem
								label={m.mcp_auto_use_tools()}
								bind:checked={autoUseTools}
							/>
							<AdvancedSwitchItem
								label={m.mcp_keep_connection()}
								bind:checked={keepConnection}
							/>
						</div>
					</div>
				</Collapsible.Content>
			</Collapsible.Root>

			<!-- 工具/提示/资源 - 只在编辑模式显示 -->
			{#if mode === "edit" && server}
				<div class="mt-4 rounded-lg">
					<div class="mb-4 flex items-center justify-between space-x-2">
						<div class="flex-1">
							<SegButton
								options={resourceTabOptions}
								selectedKey={selectedResourceTab}
								onSelect={(key) => (selectedResourceTab = key as ResourceTab)}
							/>
						</div>

						<Button
							variant="outline"
							size="icon"
							onclick={handleRefreshTools}
							disabled={isLoadingTools}
						>
							<RefreshCw class="h-4 w-4 {isLoadingTools ? 'animate-spin' : ''}" />
						</Button>
					</div>

					<div class="min-h-[200px]">
						{#if selectedResourceTab === "tools"}
							{#if tools.length === 0}
								<div
									class="text-muted-foreground flex h-[200px] items-center justify-center"
								>
									{m.mcp_no_tools()}
								</div>
							{:else}
								<div class="space-y-2">
									{#each tools as tool (tool.name)}
										<button
											type="button"
											class="flex w-full cursor-pointer items-center rounded-[10px] bg-white px-3.5 py-3 hover:bg-[#F9F9F9] dark:bg-background dark:hover:bg-[#2D2D2D]"
											onclick={() => handleToolClick(tool)}
										>
											<span class="text-setting-fg text-sm">{tool.name}</span>
										</button>
									{/each}
								</div>
							{/if}
						{:else if selectedResourceTab === "prompts"}
							<div
								class="text-muted-foreground flex h-[200px] items-center justify-center"
							>
								Coming soon...
							</div>
						{:else}
							<div
								class="text-muted-foreground flex h-[200px] items-center justify-center"
							>
								Coming soon...
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Delete Confirmation Dialog -->
	{#if mode === "edit"}
		<Dialog.Root bind:open={showDeleteDialog}>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>{m.mcp_confirm_delete_title()}</Dialog.Title>
				</Dialog.Header>
				<Dialog.Description>
					{m.mcp_confirm_delete_message({ name: server?.name || "" })}
				</Dialog.Description>
				<Dialog.Footer>
					<Button variant="outline" onclick={() => (showDeleteDialog = false)}
						>{m.mcp_cancel()}</Button
					>
					<Button variant="destructive" onclick={confirmDelete}>{m.mcp_delete()}</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>
	{/if}

	<!-- Tool Details Dialog -->
	<Dialog.Root bind:open={showToolDialog}>
		<Dialog.Content class="w-[768px] h-[600px] flex flex-col !overflow-hidden p-6 gap-0">
			<!-- 隐藏的初始焦点元素，防止自动聚焦到复制按钮 -->
			<button tabindex="-1" class="sr-only" aria-hidden="true"></button>
			<div class="flex-shrink-0 mb-4">
				<h2 class="text-lg font-semibold">{m.mcp_tool_details()}</h2>
			</div>
			{#if selectedTool}
				<div class="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
					<div class="flex-shrink-0">
						<span class="text-sm font-medium">{m.mcp_tool_name()}</span>
						<div class="mt-1 rounded-md p-2 text-sm break-words">
							{selectedTool.name}
						</div>
					</div>
					<div class="flex-shrink-0">
						<span class="text-sm font-medium">{m.mcp_tool_description()}</span>
						<div
							class="mt-1 rounded-md p-2 text-sm break-words whitespace-pre-wrap max-h-20 overflow-y-auto"
						>
							{selectedTool.description || "-"}
						</div>
					</div>
					{#if selectedTool.inputSchema}
						<div class="flex-1 min-h-0 flex flex-col">
							<span class="text-sm font-medium mb-1 flex-shrink-0"
								>{m.mcp_tool_input_schema()}</span
							>
							<div class="flex-1 min-h-0">
								<StaticCodeBlock
									code={JSON.stringify(selectedTool.inputSchema, null, 2)}
									language="json"
									canCollapse={false}
									showCollapseButton={false}
								/>
							</div>
						</div>
					{/if}
				</div>
			{/if}
			<div class="flex-shrink-0 flex justify-end gap-2 mt-4">
				<Button variant="outline" onclick={() => (showToolDialog = false)}>
					{m.mcp_cancel()}
				</Button>
			</div>
		</Dialog.Content>
	</Dialog.Root>
{/if}
