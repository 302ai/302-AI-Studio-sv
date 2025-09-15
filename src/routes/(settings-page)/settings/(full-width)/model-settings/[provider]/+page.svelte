<script lang="ts">
	import { page } from "$app/state";
	import { IconPicker } from "$lib/components/buss/icon-picker/index.js";
	import { ModelList, type Model } from "$lib/components/buss/model-list/index.js";
	import type { ModelCreateInput } from "$lib/types/model.js";
	import { ModelDialog } from "$lib/components/buss/model-dialog/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { providerState } from "$lib/stores/provider-state.svelte.js";
	import type { ModelProvider } from "$lib/types/provider.js";
	import { Eye, EyeOff } from "@lucide/svelte";
	import { toast } from "svelte-sonner";

	let providerParam = $derived(page.params.provider);
	let currentProvider = $derived(
		providerParam ? providerState.getProviderByNameOrId(providerParam) : undefined,
	);
	let formData = $state<ModelProvider>({
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
	});
	$effect(() => {
		if (currentProvider) {
			formData = {
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
			};
			modelsState = providerState.getSortedModelsByProvider(currentProvider.id);
		}
	});

	let showApiKey = $state(false);
	const apiTypes = [
		{ value: "openai", label: "OpenAI" },
		{ value: "anthropic", label: "Anthropic" },
		{ value: "gemini", label: "Google Gemini" },
		{ value: "azure", label: "Azure OpenAI" },
		{ value: "ollama", label: "Ollama" },
		{ value: "custom", label: m.common_custom() },
	];

	function handleIconChange(iconKey: string) {
		formData.icon = iconKey;
		saveFormData();
	}

	async function handleGetModels() {
		console.log("Getting models for provider:", providerParam);

		if (!currentProvider) {
			console.error("No current provider found");
			return;
		}

		console.log("Current provider:", currentProvider);
		console.log("Provider details:", {
			id: currentProvider.id,
			name: currentProvider.name,
			apiType: currentProvider.apiType,
			apiKey: currentProvider.apiKey ? "***" : "empty",
			baseUrl: currentProvider.baseUrl,
			enabled: currentProvider.enabled,
		});

		isLoadingModels = true;
		try {
			const success = await providerState.fetchModelsForProvider(currentProvider);
			console.log("Fetch result:", success);

			if (success) {
				const sortedModels = providerState.getSortedModelsByProvider(currentProvider.id);
				console.log("Sorted models:", sortedModels);
				modelsState = sortedModels;
			} else {
				console.error("Failed to fetch models");
			}
		} catch (error) {
			console.error("Error fetching models:", error);
		} finally {
			isLoadingModels = false;
		}
	}

	function handleAddModel() {
		dialogMode = "add";
		editingModel = undefined;
		showModelDialog = true;
	}
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

	function handleModelEdit(model: Model) {
		dialogMode = "edit";
		editingModel = model;
		showModelDialog = true;
	}

	function handleModelDelete(model: Model) {
		const success = providerState.removeModel(model.id);
		if (success) {
			modelsState = modelsState.filter((m) => m.id !== model.id);
		}
	}

	let modelsState = $state<Model[]>([]);
	let isLoadingModels = $state(false);
	let searchQuery = $state("");
	let showModelDialog = $state(false);
	let dialogMode = $state<"add" | "edit">("add");
	let editingModel = $state<Model | undefined>(undefined);

	function handleDialogClose() {
		showModelDialog = false;
		editingModel = undefined;
	}

	function handleDialogSave(data: Model | ModelCreateInput) {
		if (!currentProvider) return;

		try {
			if (dialogMode === "add") {
				const newModel = providerState.addModel({
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

				modelsState = [...modelsState, newModel];

				toast.success(m.text_model_add_success({ name: newModel.name }));
			} else if (editingModel) {
				const success = providerState.updateModel(editingModel.id, {
					id: data.id,
					name: data.name,
					remark: data.remark,
					type: data.type,
					enabled: data.enabled,
					capabilities: data.capabilities,
				});

				if (success) {
					const index = modelsState.findIndex((m) => m.id === editingModel!.id);
					if (index !== -1) {
						modelsState[index] = { ...modelsState[index], ...data };
					}

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

	function handleModelToggleCollected(model: Model) {
		const success = providerState.toggleModelCollected(model.id);
		if (success) {
			const index = modelsState.findIndex((m) => m.id === model.id);
			if (index !== -1) {
				modelsState[index].collected = !modelsState[index].collected;
			}
		}
	}

	function handleModelDuplicate(model: Model) {
		if (!currentProvider) return;
		let newId = `${model.id}_copy`;
		let counter = 1;
		while (providerState.models.find((m) => m.id === newId)) {
			newId = `${model.id}_copy_${counter}`;
			counter++;
		}
		const duplicatedModel = providerState.addModel({
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
		modelsState = [...modelsState, duplicatedModel];
	}

	function handleClearModels() {
		if (!currentProvider) return;
		const clearedCount = providerState.clearModelsByProvider(currentProvider.id);
		modelsState = [];
		if (clearedCount > 0) {
			toast.success(m.text_clear_models_success({ count: clearedCount.toString() }));
		}
	}
	function saveFormData() {
		if (formData.id) {
			providerState.updateProvider(formData.id, {
				name: formData.name,
				apiType: formData.apiType,
				apiKey: formData.apiKey,
				baseUrl: formData.baseUrl,
				enabled: formData.enabled,
				custom: formData.custom,
				status: formData.status,
				websites: formData.websites,
				icon: formData.icon,
			});
		}
	}
	let saveTimeout: NodeJS.Timeout;
	function handleInputChange() {
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(() => {
			saveFormData();
		}, 500);
	}
	let filteredModels = $derived(
		modelsState.filter(
			(model) =>
				searchQuery === "" ||
				model.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
				model.name.toLowerCase().includes(searchQuery.toLowerCase()),
		),
	);
</script>

<div class="flex flex-1 flex-col overflow-hidden p-6">
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
							class="h-11 rounded-settings-item bg-settings-item-bg hover:ring-1 hover:ring-ring"
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
					class="rounded-settings-item bg-settings-item-bg hover:ring-1 hover:ring-ring"
				/>
				{#if formData.baseUrl}
					<p class="text-xs text-muted-foreground">
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
						class="rounded-settings-item bg-settings-item-bg pr-10 hover:ring-1 hover:ring-ring"
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
					<p class="text-xs text-muted-foreground">
						<a href={formData.websites.apiKey} target="_blank" class="text-primary hover:underline">
							{m.text_get_api_key()}
						</a>
					</p>
				{/if}
			</div>

			<!-- 接口类型 (仅自定义供应商) -->
			{#if formData.custom}
				<div class="space-y-2">
					<Label for="apiType">{m.text_label_provider_interface_type()}</Label>
					<Select.Root
						type="single"
						bind:value={formData.apiType}
						onValueChange={(value) => {
							formData.apiType = value || "openai";
							saveFormData();
						}}
					>
						<Select.Trigger class="w-full rounded-settings-item bg-settings-item-bg">
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
			<div class="flex items-center gap-3 pt-4">
				<Button variant="default" onclick={handleGetModels} disabled={isLoadingModels}>
					{isLoadingModels ? m.text_button_get_models_loading() : m.text_button_get_models()}
				</Button>
				<Button variant="outline" onclick={handleAddModel}>{m.text_button_add_model()}</Button>
				<Button
					variant="destructive"
					onclick={handleClearModels}
					disabled={modelsState.length === 0}
				>
					{m.text_button_clear_models()}
				</Button>
				<div class="flex-1"></div>
				<Input
					bind:value={searchQuery}
					placeholder={m.placeholder_input_search_model()}
					class="w-64 rounded-settings-item bg-settings-item-bg hover:ring-1 hover:ring-ring"
				/>
			</div>
		</div>

		<!-- 模型列表区域 -->
		<div class="min-h-0 w-full flex-1 overflow-hidden">
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
