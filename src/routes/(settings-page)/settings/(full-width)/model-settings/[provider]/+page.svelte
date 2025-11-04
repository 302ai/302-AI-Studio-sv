<script lang="ts">
	import { page } from "$app/state";
	import { IconPicker } from "$lib/components/buss/icon-picker/index.js";
	import { ModelDialog } from "$lib/components/buss/model-dialog/index.js";
	import { ModelList } from "$lib/components/buss/model-list/index.js";
	import { SettingSwitchItem } from "$lib/components/buss/settings/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { persistedModelState, providerState } from "$lib/stores/provider-state.svelte.js";
	import { Eye, EyeOff } from "@lucide/svelte";
	import type { Model, ModelCreateInput, ModelProvider } from "@shared/types";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";

	const apiTypes = [
		{ value: "302ai", label: "302.AI" },
		{ value: "openai", label: "OpenAI" },
		{ value: "anthropic", label: "Anthropic" },
		{ value: "gemini", label: "Google Gemini" },
		// { value: "azure", label: "Azure OpenAI" },
		// { value: "ollama", label: "Ollama" },
		// { value: "custom", label: m.common_custom() },
	];

	function getChatEndpointUrl(baseUrl: string, apiType: string): string {
		const cleanBaseUrl = baseUrl.replace(/\/$/, "");

		switch (apiType.toLowerCase()) {
			case "openai":
			case "302ai":
				if (cleanBaseUrl.endsWith("/v1")) {
					return `${cleanBaseUrl}/chat/completions`;
				}
				return `${cleanBaseUrl}/v1/chat/completions`;
			case "anthropic":
				return `${cleanBaseUrl}/v1/messages`;
			case "gemini":
			case "google":
				return `${cleanBaseUrl}/v1beta/generateContent`;
			default:
				if (cleanBaseUrl.endsWith("/v1")) {
					return `${cleanBaseUrl}/chat/completions`;
				}
				return `${cleanBaseUrl}/v1/chat/completions`;
		}
	}

	let isLoadingModels = $state(false);
	let searchQuery = $state("");
	let showModelDialog = $state(false);
	let dialogMode = $state<"add" | "edit">("add");
	let editingModel = $state<Model | undefined>(undefined);
	let pendingRemovedIds = $state<Set<string>>(new Set());

	const providerParam = $derived(page.params.provider);
	const currentProvider = $derived(
		providerParam ? providerState.getProviderByNameOrId(providerParam) : undefined,
	);
	let showApiKey = $state(false);

	const sortedModels = $derived.by(() => providerState.getSortedModels());

	let formData = $derived.by<ModelProvider>(() => {
		if (currentProvider) {
			return {
				id: currentProvider.id,
				name: currentProvider.name,
				apiType: currentProvider.apiType,
				apiKey: currentProvider.apiKey,
				baseUrl: currentProvider.baseUrl,
				enabled: currentProvider.enabled,
				custom: currentProvider.custom || false,
				status: currentProvider.status,
				websites: { ...currentProvider.websites },
				icon: currentProvider.icon,
				autoUpdateModels: currentProvider.autoUpdateModels || false,
			};
		}

		return {
			id: "",
			name: "",
			apiType: "openai",
			apiKey: "",
			baseUrl: "",
			enabled: true,
			custom: false,
			status: "pending",
			websites: {
				official: "",
				apiKey: "",
				docs: "",
				models: "",
				defaultBaseUrl: "",
			},
			icon: undefined,
			autoUpdateModels: false,
		};
	});

	async function saveFormData() {
		if (formData.id) {
			await providerState.updateProvider(formData.id, {
				name: formData.name,
				apiType: formData.apiType,
				apiKey: formData.apiKey,
				baseUrl: formData.baseUrl,
				enabled: formData.enabled,
				custom: formData.custom,
				status: formData.status,
				websites: formData.websites,
				icon: formData.icon,
				autoUpdateModels: formData.autoUpdateModels,
			});
		}
	}

	async function handleIconChange(iconKey: string) {
		formData.icon = iconKey;
		await saveFormData();
	}

	async function handleGetModels() {
		if (!currentProvider) {
			return;
		}
		isLoadingModels = true;

		// 先保存表单数据，确保使用最新的 API key
		clearTimeout(saveTimeout);
		await saveFormData();

		await providerState.fetchModelsForProvider(currentProvider);
		isLoadingModels = false;
	}

	function handleAddModel() {
		dialogMode = "add";
		editingModel = undefined;
		showModelDialog = true;
	}

	function handleModelEdit(model: Model) {
		dialogMode = "edit";
		editingModel = model;
		showModelDialog = true;
	}

	async function handleModelDelete(model: Model) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		pendingRemovedIds = new Set(pendingRemovedIds).add(model.id);
		providerState.scheduleRemoveModel(model.id);
	}

	function handleDialogClose() {
		showModelDialog = false;
		editingModel = undefined;
	}

	async function handleDialogSave(data: Model | ModelCreateInput) {
		if (!currentProvider) return;

		try {
			if (dialogMode === "add") {
				const newModel = await providerState.addModel({
					id: data.id,
					name: data.name,
					remark: data.remark,
					providerId: currentProvider.id,
					capabilities: data.capabilities,
					type: data.type,
					custom: true,
					enabled: data.enabled,
					collected: false,
				});

				toast.success(m.text_model_add_success({ name: newModel.name }));
			} else if (editingModel) {
				const success = await providerState.updateModel(editingModel.id, {
					id: data.id,
					name: data.name,
					remark: data.remark,
					type: data.type,
					enabled: data.enabled,
					capabilities: data.capabilities,
				});

				if (success) {
					toast.success(m.text_model_update_success({ name: data.name }));
				} else {
					toast.error(m.text_model_update_failed());
				}
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "An error occurred";
			toast.error(message);
		}
	}

	async function handleModelToggleCollected(model: Model) {
		await providerState.toggleModelCollected(model.id);
	}

	async function handleModelDuplicate(model: Model) {
		if (!currentProvider) return;
		let newId = `${model.id}_copy`;
		let counter = 1;
		while (persistedModelState.current.find((m) => m.id === newId)) {
			newId = `${model.id}_copy_${counter}`;
			counter++;
		}
		console.log(model.capabilities);
		await providerState.addModel({
			id: newId,
			name: `${model.name} (Copy)`,
			remark: model.remark ? `${model.remark} (Copy)` : "",
			providerId: currentProvider.id,
			capabilities: new Set(model.capabilities),
			type: model.type,
			custom: true,
			enabled: model.enabled,
			collected: false,
		});
	}

	async function handleClearModels() {
		if (!currentProvider) return;
		const clearedCount = await providerState.clearModelsByProvider(currentProvider.id);
		if (clearedCount > 0) {
			toast.success(m.text_clear_models_success({ count: clearedCount.toString() }));
		}
	}

	let saveTimeout: NodeJS.Timeout;
	function handleInputChange() {
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(() => {
			saveFormData();
		}, 500);
	}
	const filteredModels = $derived(
		sortedModels
			.filter((m) => m.providerId === currentProvider?.id)
			.filter(
				(model) =>
					searchQuery === "" ||
					model.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
					model.name.toLowerCase().includes(searchQuery.toLowerCase()),
			)
			.filter((m) => !pendingRemovedIds.has(m.id)),
	);

	// 页面加载时自动更新模型（异步执行，不阻塞页面渲染）
	onMount(() => {
		if (currentProvider?.autoUpdateModels && currentProvider.apiKey) {
			// 使用 setTimeout 将更新操作推迟到下一个事件循环
			// 让页面先完成渲染，避免切换标签页时卡顿
			setTimeout(() => {
				handleGetModels();
			}, 0);
		}
	});
</script>

<div class="flex h-full min-w-0 flex-1 flex-col overflow-hidden p-6">
	<!-- 配置标题 -->
	<div class="mb-6 flex flex-shrink-0 flex-col gap-1">
		<h2 class="max-w-full break-all whitespace-normal">
			{m.text_provider_configure({
				name:
					formData.name ||
					(formData.custom ? m.text_provider_custom_name() : m.text_provider_unnamed()),
			})}
		</h2>
	</div>

	<div class="flex min-h-0 flex-1 flex-col gap-6">
		<!-- 表单 -->
		<div class="flex-shrink-0 space-y-4">
			{#if formData.custom}
				<!-- 图标和名称（自定义供应商） -->
				<div class="flex items-end gap-4">
					<div class="flex flex-col gap-2">
						<Label class="text-sm font-medium">{m.text_label_provider_icon()}</Label>
						<IconPicker value={formData.icon || formData.apiType} onChange={handleIconChange} />
					</div>
					<div class="flex flex-1 flex-col gap-2">
						<Label for="name" class="text-sm font-medium">{m.text_label_provider_name()}</Label>
						<Input
							id="name"
							bind:value={formData.name}
							placeholder={m.placeholder_input_provider_name()}
							oninput={handleInputChange}
							class="rounded-settings-item bg-settings-item-bg hover:ring-ring h-11 hover:ring-1"
						/>
					</div>
				</div>
			{/if}

			<!-- Base URL -->
			<div class="space-y-2">
				<Label for="baseUrl">{m.text_label_provider_base_url()}</Label>
				<Input
					id="baseUrl"
					bind:value={formData.baseUrl}
					placeholder={formData.custom ? m.placeholder_input_provider_base_url() : ""}
					oninput={handleInputChange}
					class="rounded-settings-item bg-settings-item-bg hover:ring-ring hover:ring-1"
				/>
				{#if formData.baseUrl}
					<p class="text-muted-foreground max-w-full break-all text-xs">
						{m.text_base_url_request_info({
							url: getChatEndpointUrl(formData.baseUrl, formData.apiType),
						})}
					</p>
				{/if}
			</div>

			<!-- API Key -->
			<div class="space-y-2">
				<Label for="apiKey">{m.text_label_provider_api_key()}</Label>
				<div class="relative">
					<Input
						id="apiKey"
						type={showApiKey ? "text" : "password"}
						bind:value={formData.apiKey}
						placeholder={m.placeholder_input_provider_api_key()}
						class="rounded-settings-item bg-settings-item-bg hover:ring-ring pr-10 hover:ring-1"
						oninput={handleInputChange}
					/>
					<Button
						variant="ghost"
						size="sm"
						class="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent"
						onclick={() => (showApiKey = !showApiKey)}
					>
						{#if showApiKey}
							<EyeOff class="h-4 w-4" />
						{:else}
							<Eye class="h-4 w-4" />
						{/if}
					</Button>
				</div>
				{#if !formData.custom && formData.websites.apiKey}
					<p class="text-muted-foreground text-xs">
						<a
							href={formData.websites.apiKey}
							target="_blank"
							class="text-primary hover:underline"
							onclick={(e) => {
								e.preventDefault();
								window.electronAPI.externalLinkService.openExternalLink(formData.websites.apiKey);
							}}
						>
							{m.text_get_api_key()}
						</a>
					</p>
				{/if}
			</div>

			<!-- 自动更新模型 -->
			<div class="space-y-2">
				<Label class="text-sm font-medium">{m.text_label_provider_auto_update_models()}</Label>
				<SettingSwitchItem
					label={m.text_label_provider_auto_update_models_desc()}
					checked={formData.autoUpdateModels}
					onCheckedChange={(v) => {
						formData.autoUpdateModels = v;
						saveFormData();
					}}
				/>
			</div>

			<!-- 接口类型 (仅自定义供应商) -->
			{#if formData.custom}
				<div class="space-y-2">
					<Label for="apiType">{m.text_label_provider_interface_type()}</Label>
					<Select.Root
						type="single"
						bind:value={formData.apiType}
						onValueChange={(value) => {
							formData.apiType = (value as ModelProvider["apiType"]) || "openai";
							saveFormData();
						}}
					>
						<Select.Trigger class="rounded-settings-item bg-settings-item-bg w-full">
							{apiTypes.find((t) => t.value === formData.apiType)?.label ||
								m.placeholder_select_provider_interface_type()}
						</Select.Trigger>
						<Select.Content>
							{#each apiTypes as type (type.value)}
								<Select.Item value={type.value} label={type.label} />
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			{/if}

			<!-- 操作按钮 -->
			<div class="@container flex flex-wrap items-center gap-3 pt-4">
				<Button variant="default" onclick={handleGetModels} disabled={isLoadingModels}>
					{isLoadingModels ? m.text_button_get_models_loading() : m.text_button_get_models()}
				</Button>
				<Button variant="outline" onclick={handleAddModel}>{m.text_button_add_model()}</Button>
				<Button
					variant="destructive"
					onclick={handleClearModels}
					disabled={filteredModels.length === 0}
				>
					{m.text_button_clear_models()}
				</Button>
				<div class="@[600px]:flex-1 @[600px]:block hidden"></div>
				<Input
					bind:value={searchQuery}
					placeholder={m.placeholder_input_search_model()}
					class="rounded-settings-item bg-settings-item-bg! hover:ring-ring @[600px]:max-w-xs w-full @[600px]:w-auto min-w-0 hover:ring-1"
				/>
			</div>
		</div>

		<!-- 模型列表区域 -->
		<div class="min-h-0 w-full flex-1">
			<ModelList
				models={filteredModels}
				onModelEdit={handleModelEdit}
				onModelDelete={handleModelDelete}
				onModelToggleCollected={handleModelToggleCollected}
				onModelDuplicate={handleModelDuplicate}
			/>
		</div>
	</div>
</div>

<!-- Model Dialog -->
<ModelDialog
	bind:open={showModelDialog}
	mode={dialogMode}
	model={editingModel}
	providerId={currentProvider?.id || ""}
	onClose={handleDialogClose}
	onSave={handleDialogSave}
/>
