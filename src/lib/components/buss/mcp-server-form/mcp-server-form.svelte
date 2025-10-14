<script lang="ts">
	import { goto } from "$app/navigation";
	import EmojiPicker from "$lib/components/buss/emoji-picker/emoji-picker.svelte";
	import AdvancedSwitchItem from "$lib/components/buss/settings/advanced-switch-item.svelte";
	import KeyValueList from "$lib/components/buss/settings/key-value-list.svelte";
	import SettingInputField from "$lib/components/buss/settings/setting-input-field.svelte";
	import SettingSelectField from "$lib/components/buss/settings/setting-select-field.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Collapsible from "$lib/components/ui/collapsible/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { mcpState } from "$lib/stores/mcp-state.svelte";
	import { ChevronLeft, Trash2 } from "@lucide/svelte";
	import type { McpServerType } from "@shared/storage/mcp";
	import { nanoid } from "nanoid";
	import { toast } from "svelte-sonner";
	import * as m from "$lib/paraglide/messages.js";

	interface KeyValuePair {
		key: string;
		value: string;
		id: string;
	}

	interface Props {
		mode: "add" | "edit";
		serverId?: string;
	}

	let { mode, serverId }: Props = $props();

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
		}
	});

	const typeOptions = [
		{ value: "streamableHTTP", label: "Streamable HTTP" },
		{ value: "stdio", label: "STDIO" },
		{ value: "sse", label: "SSE" },
	];

	function handleBack() {
		goto("/settings/mcp-settings");
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

			if (mode === "add") {
				const now = new Date();
				mcpState.addServer({
					id: nanoid(),
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

			goto("/settings/mcp-settings");
		} catch (error) {
			console.error("Failed to save MCP server:", error);
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
			goto("/settings/mcp-settings");
		}
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
					<Button variant="outline" size="sm" class="text-[#D82525]" onclick={handleDelete}>
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
			<Collapsible.Root bind:open={isAdvancedOpen}>
				<Collapsible.Trigger
					class="bg-settings-item-bg flex w-full items-center justify-between rounded-lg px-3 py-2"
				>
					<span class="font-medium">{m.mcp_advanced_settings()}</span>
				</Collapsible.Trigger>
				<Collapsible.Content class="bg-settings-item-bg mt-2 rounded-lg p-4">
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
							<AdvancedSwitchItem label={m.mcp_auto_use_tools()} bind:checked={autoUseTools} />
							<AdvancedSwitchItem label={m.mcp_keep_connection()} bind:checked={keepConnection} />
						</div>
					</div>
				</Collapsible.Content>
			</Collapsible.Root>
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
{/if}
