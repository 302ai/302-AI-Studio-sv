<script lang="ts" module>
	import type { Model, ModelCapability, ModelCreateInput, ModelType } from "$lib/types/model.js";

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
	let formData = $state({
		id: model?.id || "",
		name: model?.name || "",
		remark: model?.remark || "",
		type: model?.type || ("language" as ModelType),
		enabled: model?.enabled ?? true,
		capabilities: model?.capabilities ? new Set(model.capabilities) : new Set<ModelCapability>(),
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

	let dialogTitle = $derived(
		mode === "add" ? m.text_dialog_add_model_title() : m.text_dialog_edit_model_title(),
	);
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
				<Input
					id="modelId"
					bind:value={formData.id}
					placeholder={m.placeholder_input_model_id()}
					class="rounded-settings-item bg-settings-item-bg hover:ring-1 hover:ring-ring"
				/>
			</div>

			<!-- Model Name -->
			<div class="space-y-2">
				<Label for="modelName">{m.text_label_model_name()}</Label>
				<Input
					id="modelName"
					bind:value={formData.name}
					placeholder={m.placeholder_input_model_name()}
					class="rounded-settings-item bg-settings-item-bg hover:ring-1 hover:ring-ring"
				/>
			</div>

			<!-- Model Remark -->
			<div class="space-y-2">
				<Label for="modelRemark">{m.text_label_model_remark()}</Label>
				<Input
					id="modelRemark"
					bind:value={formData.remark}
					placeholder={m.placeholder_input_model_remark()}
					class="rounded-settings-item bg-settings-item-bg hover:ring-1 hover:ring-ring"
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
					<Select.Trigger class="w-full rounded-settings-item bg-settings-item-bg">
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
						<div class="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent/10">
							<Checkbox
								class="border-muted-foreground/40 bg-transparent hover:border-muted-foreground/70 dark:border-white/30"
								id={capability.value}
								checked={formData.capabilities.has(capability.value)}
								onCheckedChange={(checked) => toggleCapability(capability.value, !!checked)}
							/>
							<Label for={capability.value} class="cursor-pointer text-sm font-normal">
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
