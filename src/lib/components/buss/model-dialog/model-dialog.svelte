<script lang="ts" module>
	import type { Model, ModelCapability, ModelCreateInput, ModelType } from "@shared/types";

	export interface Props {
		open: boolean;
		mode: "add" | "edit";
		model?: Model;
		providerId: string;
		onClose: () => void;
		onSave: (data: ModelCreateInput | Model) => void;
	}
</script>

<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { Checkbox } from "$lib/components/ui/checkbox/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import { Switch } from "$lib/components/ui/switch/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { persistedModelState } from "$lib/stores/provider-state.svelte.js";
	import { cn } from "$lib/utils.js";
	import { getAvailableModelIdsForDropdown } from "$lib/utils/model-filters.js";

	let { open = $bindable(), mode, model, providerId, onClose, onSave }: Props = $props();
	const modelTypes: { value: ModelType; label: string }[] = [
		{ value: "language", label: m.text_model_type_chat() },
		{ value: "image-generation", label: m.text_model_type_image() },
		{ value: "tts", label: m.text_model_type_audio() },
		{ value: "embedding", label: m.text_model_type_embedding() },
		{ value: "rerank", label: m.text_model_type_rerank() },
	];
	const availableCapabilities: { value: ModelCapability; label: string }[] = [
		{ value: "vision", label: m.text_capability_vision() },
		{ value: "function_call", label: m.text_capability_function_call() },
		{ value: "reasoning", label: m.text_capability_reasoning() },
		{ value: "music", label: m.text_capability_music() },
		{ value: "video", label: m.text_capability_video() },
	];
	const formData = $state({
		id: model?.id || "",
		name: model?.name || "",
		remark: model?.remark || "",
		type: model?.type || ("language" as ModelType),
		enabled: model?.enabled ?? true,
		capabilities: model?.capabilities
			? new Set(model.capabilities)
			: new Set<ModelCapability>(),
	});
	$effect(() => {
		if (model) {
			formData.id = model.id;
			formData.name = model.name;
			formData.remark = model.remark;
			formData.type = model.type;
			formData.enabled = model.enabled;
			formData.capabilities = new Set(model.capabilities);
		} else {
			formData.id = "";
			formData.name = "";
			formData.remark = "";
			formData.type = "language";
			formData.enabled = true;
			formData.capabilities = new Set();
		}
	});

	// 当对话框打开且是添加模式时，重置表单数据
	$effect(() => {
		if (open && mode === "add" && !model) {
			formData.id = "";
			formData.name = "";
			formData.remark = "";
			formData.type = "language";
			formData.enabled = true;
			formData.capabilities = new Set();
		}
	});

	function handleSave() {
		if (!formData.id.trim() || !formData.name.trim()) return;

		if (mode === "add") {
			const createData: ModelCreateInput = {
				id: formData.id,
				name: formData.name,
				remark: formData.remark,
				providerId,
				capabilities: formData.capabilities,
				type: formData.type,
				custom: true,
				enabled: formData.enabled,
				collected: false,
				isAddedByUser: true,
			};
			onSave(createData);
		} else if (model) {
			const updatedModel: Model = {
				...model,
				id: formData.id,
				name: formData.name,
				remark: formData.remark,
				type: formData.type,
				enabled: formData.enabled,
				capabilities: formData.capabilities,
			};
			onSave(updatedModel);
		}

		onClose();
	}

	function toggleCapability(capability: ModelCapability, checked: boolean) {
		if (checked) {
			formData.capabilities.add(capability);
		} else {
			formData.capabilities.delete(capability);
		}

		formData.capabilities = new Set(formData.capabilities);
	}

	const dialogTitle = $derived(
		mode === "add" ? m.text_dialog_add_model_title() : m.text_dialog_edit_model_title(),
	);

	// 获取该 provider 的可用模型ID列表，用于 Model ID 候选下拉列表
	// 使用统一的过滤方法：只包含 isFeatured === false && isAddedByUser === false 的模型
	const allAvailableModelIds = $derived.by(() => {
		if (mode !== "add" || !providerId) return [];
		return getAvailableModelIdsForDropdown(persistedModelState.current, providerId);
	});

	// 根据输入值过滤候选列表（全量数据源，只过滤显示）
	const filteredModelIds = $derived.by(() => {
		if (allAvailableModelIds.length === 0) {
			return [];
		}
		// 没有输入时显示全部
		if (!formData.id.trim()) {
			return allAvailableModelIds;
		}
		// 有输入时，只显示包含输入内容的模型ID
		const lowerInput = formData.id.toLowerCase();
		return allAvailableModelIds.filter((id) => id.toLowerCase().includes(lowerInput));
	});

	let showSuggestions = $state(false);
	let inputRef = $state<HTMLInputElement | null>(null);
	let suggestionsRef = $state<HTMLDivElement | null>(null);
	let hoveredIndex = $state(-1);

	function handleModelIdSelect(modelId: string) {
		formData.id = modelId;
		showSuggestions = false;
		hoveredIndex = -1;
		// 尝试自动填充模型名称和能力
		const selectedModel = persistedModelState.current.find(
			(m) => m.providerId === providerId && m.id === modelId,
		);
		if (selectedModel) {
			if (!formData.name) {
				formData.name = selectedModel.name;
			}
			// 如果模型有 capabilities，自动填充
			if (selectedModel.capabilities && selectedModel.capabilities.size > 0) {
				formData.capabilities = new Set(selectedModel.capabilities);
			}
		}
		inputRef?.focus();
	}

	function handleInputFocus() {
		// 只要有可用的模型ID列表，就显示下拉列表
		if (allAvailableModelIds.length > 0) {
			showSuggestions = true;
		}
	}

	function handleInputChange() {
		// 输入时也显示下拉列表（如果有可用的模型ID）
		if (allAvailableModelIds.length > 0) {
			showSuggestions = true;
		}
	}

	function handleInputBlur(_event: FocusEvent) {
		// 延迟关闭，以便点击下拉项时能触发
		setTimeout(() => {
			// 检查焦点是否移到了下拉列表中
			if (suggestionsRef && suggestionsRef.contains(document.activeElement)) {
				return;
			}
			showSuggestions = false;
			hoveredIndex = -1;
		}, 200);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!showSuggestions || filteredModelIds.length === 0) return;

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				hoveredIndex = hoveredIndex < filteredModelIds.length - 1 ? hoveredIndex + 1 : 0;
				break;
			case "ArrowUp":
				event.preventDefault();
				hoveredIndex = hoveredIndex > 0 ? hoveredIndex - 1 : filteredModelIds.length - 1;
				break;
			case "Enter":
				if (hoveredIndex >= 0 && hoveredIndex < filteredModelIds.length) {
					event.preventDefault();
					handleModelIdSelect(filteredModelIds[hoveredIndex]);
				}
				break;
			case "Escape":
				showSuggestions = false;
				hoveredIndex = -1;
				break;
		}
	}

	// 当对话框关闭时重置状态
	$effect(() => {
		if (!open) {
			showSuggestions = false;
			hoveredIndex = -1;
		}
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content data-model-dialog>
		<Dialog.Header>
			<Dialog.Title>{dialogTitle}</Dialog.Title>
		</Dialog.Header>

		<div class="space-y-4">
			<!-- Model ID -->
			<div class="space-y-2">
				<Label for="modelId">{m.text_label_model_id()}</Label>
				<div class="relative">
					<Input
						id="modelId"
						bind:ref={inputRef}
						bind:value={formData.id}
						placeholder={m.placeholder_input_model_id()}
						class="rounded-settings-item bg-settings-item-bg hover:ring-ring hover:ring-1"
						onfocus={handleInputFocus}
						onblur={handleInputBlur}
						onkeydown={handleKeyDown}
						oninput={handleInputChange}
					/>
					{#if mode === "add" && showSuggestions && filteredModelIds.length > 0}
						<div
							bind:this={suggestionsRef}
							class="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover shadow-md"
							tabindex="-1"
						>
							{#each filteredModelIds as modelId, index (modelId)}
								<button
									type="button"
									class={cn(
										"w-full px-3 py-2 text-left text-sm transition-colors",
										hoveredIndex === index
											? "bg-accent text-accent-foreground"
											: "hover:bg-accent/50",
									)}
									onmouseenter={() => (hoveredIndex = index)}
									onclick={() => handleModelIdSelect(modelId)}
								>
									{modelId}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- Model Name -->
			<div class="space-y-2">
				<Label for="modelName">{m.text_label_model_name()}</Label>
				<Input
					id="modelName"
					bind:value={formData.name}
					placeholder={m.placeholder_input_model_name()}
					class="rounded-settings-item bg-settings-item-bg hover:ring-ring hover:ring-1"
				/>
			</div>

			<!-- Model Remark -->
			<div class="space-y-2">
				<Label for="modelRemark">{m.text_label_model_remark()}</Label>
				<Input
					id="modelRemark"
					bind:value={formData.remark}
					placeholder={m.placeholder_input_model_remark()}
					class="rounded-settings-item bg-settings-item-bg hover:ring-ring hover:ring-1"
				/>
			</div>

			<!-- Model Type -->
			<div class="space-y-2">
				<Label for="modelType">{m.text_label_model_type()}</Label>
				<Select.Root
					type="single"
					bind:value={formData.type}
					onValueChange={(value) => {
						formData.type = (value || "language") as ModelType;
					}}
				>
					<Select.Trigger class="rounded-settings-item bg-settings-item-bg w-full">
						{modelTypes.find((t) => t.value === formData.type)?.label || formData.type}
					</Select.Trigger>
					<Select.Content>
						{#each modelTypes as type (type.value)}
							<Select.Item value={type.value} label={type.label} />
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			<!-- Capabilities -->
			<div class="space-y-2">
				<Label>{m.text_label_model_capabilities()}</Label>
				<div class="flex flex-wrap gap-3">
					{#each availableCapabilities as capability (capability.value)}
						<div
							class="hover:bg-accent/10 flex items-center gap-2 rounded-md px-2 py-1"
						>
							<Checkbox
								class="border-muted-foreground/40 cursor-pointer hover:border-muted-foreground/70 bg-transparent dark:border-white/30"
								id={capability.value}
								checked={formData.capabilities.has(capability.value)}
								onCheckedChange={(checked) =>
									toggleCapability(capability.value, !!checked)}
							/>
							<Label
								for={capability.value}
								class="cursor-pointer text-sm font-normal"
							>
								{capability.label}
							</Label>
						</div>
					{/each}
				</div>
			</div>

			<!-- Enabled Switch -->
			<div class="flex items-center justify-between">
				<Label for="modelEnabled">{m.text_label_model_enabled()}</Label>
				<Switch id="modelEnabled" bind:checked={formData.enabled} />
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={onClose}>
				{m.text_button_cancel()}
			</Button>
			<Button onclick={handleSave} disabled={!formData.id.trim() || !formData.name.trim()}>
				{m.text_button_save()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
