<script lang="ts" module>
	interface Props {
		model: Model;
		isLast?: boolean;
		onEdit?: () => void;
		onDelete?: () => void;
		onToggleCollected?: () => void;
		onDuplicate?: () => void;
	}
</script>

<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import * as ContextMenu from "$lib/components/ui/context-menu/index.js";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { cn } from "$lib/utils";
	import {
		Copy,
		Files,
		Hammer,
		Image,
		Lightbulb,
		MoreVertical,
		Music,
		PenLine,
		Play,
		Star,
		Trash2,
	} from "@lucide/svelte";
	import type { Model } from "@shared/types";
	import { toast } from "svelte-sonner";

	const {
		model,
		isLast = false,
		onEdit,
		onDelete,
		onToggleCollected,
		onDuplicate,
	}: Props = $props();

	const typeLabel = $derived.by(() => {
		switch (model.type) {
			case "language":
				return m.text_model_type_chat();
			case "embedding":
				return m.text_model_type_embedding();
			case "image-generation":
				return m.text_model_type_image();
			case "tts":
				return m.text_model_type_audio();
			case "rerank":
				return "Rerank";
			default:
				return model.type;
		}
	});

	const capabilityInfos = $derived.by(() => {
		const result = [];
		for (const capability of model.capabilities) {
			const capStr = String(capability);
			let info = null;
			switch (capStr) {
				case "reasoning":
					info = {
						Icon: Lightbulb,
						bgClass: "bg-accent dark:bg-primary/10",
						iconClass: "text-primary",
						title: m.text_capability_reasoning(),
					};
					break;
				case "vision":
					info = {
						Icon: Image,
						bgClass: "bg-green-100 dark:bg-green-900/20",
						iconClass: "text-green-600 dark:text-green-400",
						title: m.text_capability_vision(),
					};
					break;
				case "music":
					info = {
						Icon: Music,
						bgClass: "bg-pink-50 dark:bg-pink-900/20",
						iconClass: "text-pink-500",
						title: m.text_capability_music(),
					};
					break;
				case "video":
					info = {
						Icon: Play,
						bgClass: "bg-blue-50 dark:bg-blue-900/20",
						iconClass: "text-blue-600",
						title: m.text_capability_video(),
					};
					break;
				case "function_call":
					info = {
						Icon: Hammer,
						bgClass: "bg-orange-50 dark:bg-orange-900/20",
						iconClass: "text-orange-500",
						title: m.text_capability_function_call(),
					};
					break;
			}
			if (info) result.push({ ...info, key: capStr });
		}
		return result;
	});

	const getCapabilityIcon = (capability: string) => {
		switch (capability) {
			case "reasoning":
				return {
					Icon: Lightbulb,
					bgClass: "bg-accent dark:bg-primary/10",
					iconClass: "text-primary",
					title: m.text_capability_reasoning(),
				};
			case "vision":
				return {
					Icon: Image,
					bgClass: "bg-green-100 dark:bg-green-900/20",
					iconClass: "text-green-600 dark:text-green-400",
					title: m.text_capability_vision(),
				};
			case "music":
				return {
					Icon: Music,
					bgClass: "bg-pink-50 dark:bg-pink-900/20",
					iconClass: "text-pink-500",
					title: m.text_capability_music(),
				};
			case "video":
				return {
					Icon: Play,
					bgClass: "bg-blue-50 dark:bg-blue-900/20",
					iconClass: "text-blue-600",
					title: m.text_capability_video(),
				};
			case "function_call":
				return {
					Icon: Hammer,
					bgClass: "bg-orange-50 dark:bg-orange-900/20",
					iconClass: "text-orange-500",
					title: m.text_capability_function_call(),
				};
			default:
				return null;
		}
	};

	const getTypeLabel = (type: string) => {
		switch (type) {
			case "language":
				return m.text_model_type_chat();
			case "embedding":
				return m.text_model_type_embedding();
			case "image-generation":
				return m.text_model_type_image();
			case "tts":
				return m.text_model_type_audio();
			case "rerank":
				return "Rerank";
			default:
				return type;
		}
	};

	const handleCopyModelName = async () => {
		try {
			await navigator.clipboard.writeText(model.remark || model.name);
			toast.success(m.text_context_copy_name());
		} catch {
			toast.error(m.text_model_copy_name_failed());
		}
	};

	const handleCopyModelId = async () => {
		try {
			await navigator.clipboard.writeText(model.id);
			toast.success(m.text_context_copy_id());
		} catch {
			toast.error(m.text_model_copy_id_failed());
		}
	};

	const handleDuplicate = () => {
		if (onDuplicate) {
			onDuplicate();
		}
	};
</script>

<ContextMenu.Root>
	<ContextMenu.Trigger
		class={cn(
			"ring-primary hover:bg-muted/50 h-[50px] w-full cursor-pointer outline-transparent",
			!isLast ? "border-border border-b" : "",
		)}
	>
		<div class="grid h-full w-full" style="grid-template-columns: 2fr 0.8fr 1.2fr 1fr;">
			<!-- 模型名称 -->
			<div class="flex h-full items-center overflow-hidden pr-2 pl-4 outline-hidden">
				<div class="truncate" title={model.remark || model.name}>
					{model.remark || model.name}
				</div>
			</div>

			<!-- 类型 -->
			<div class="flex h-full items-center overflow-hidden px-1 outline-hidden">
				<div class="truncate text-sm text-[#333333] dark:text-[#E6E6E6]">
					{typeLabel}
				</div>
			</div>

			<!-- 能力 -->
			<div class="flex h-full items-center gap-2 overflow-hidden outline-hidden">
				{#each capabilityInfos as capabilityInfo (capabilityInfo.key)}
					<div
						class={cn(
							"flex size-6 flex-shrink-0 items-center justify-center rounded-sm",
							capabilityInfo.bgClass,
						)}
						title={capabilityInfo.title}
					>
						<capabilityInfo.Icon class={cn("h-4 w-4", capabilityInfo.iconClass)} />
					</div>
				{/each}
			</div>

			<!-- 操作 -->
			<div
				class="@container flex h-full items-center justify-center overflow-hidden pr-2 outline-hidden"
			>
				<!-- 默认显示所有按钮 -->
				<div class="@[80px]:flex hidden h-full items-center justify-center">
					<!-- Star -->
					<Button
						variant="ghost"
						size="icon"
						class="pressed:bg-accent/20 hover:bg-accent/10 h-8 w-8 rounded-lg p-0"
						onclick={onToggleCollected}
						title={model.collected ? m.title_button_unstar() : m.title_button_star()}
					>
						<Star
							class={cn(
								"size-4",
								model.collected
									? "fill-yellow-500 text-yellow-500"
									: "text-muted-foreground hover:text-foreground",
							)}
						/>
					</Button>

					<!-- Edit -->
					<Button
						variant="ghost"
						size="icon"
						class="pressed:bg-accent/20 hover:bg-accent/10 h-8 w-8 rounded-lg p-0"
						onclick={onEdit}
						title={m.title_button_edit()}
					>
						<PenLine class="text-muted-foreground hover:text-foreground size-4" strokeWidth={1.5} />
					</Button>

					<!-- Delete -->
					<Button
						variant="ghost"
						size="icon"
						class="pressed:bg-destructive/20 hover:bg-destructive/10 h-8 w-8 rounded-lg p-0"
						onclick={onDelete}
						title={m.title_button_delete()}
					>
						<Trash2 class="text-destructive/70 hover:text-destructive size-4" />
					</Button>
				</div>

				<!-- 空间不足时显示更多按钮 -->
				<div class="@[80px]:hidden flex">
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							<Button
								variant="ghost"
								size="icon"
								class="pressed:bg-accent/20 hover:bg-accent/10 h-8 w-8 rounded-lg p-0"
							>
								<MoreVertical class="size-4" />
							</Button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="end" class="w-40">
							<DropdownMenu.Item onclick={onToggleCollected}>
								<Star
									class={cn(
										"mr-2 h-4 w-4",
										model.collected ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground",
									)}
								/>
								{model.collected ? m.text_button_unstar() : m.text_button_star()}
							</DropdownMenu.Item>
							<DropdownMenu.Item onclick={onEdit}>
								<PenLine class="mr-2 h-4 w-4" />
								{m.text_button_edit()}
							</DropdownMenu.Item>
							{#if onDuplicate}
								<DropdownMenu.Item onclick={handleDuplicate}>
									<Files class="mr-2 h-4 w-4" />
									{m.text_context_duplicate()}
								</DropdownMenu.Item>
							{/if}
							<DropdownMenu.Separator />
							<DropdownMenu.Item onclick={onDelete} class="text-destructive focus:text-destructive">
								<Trash2 class="mr-2 h-4 w-4" />
								{m.text_button_delete()}
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</div>
			</div>
		</div>
	</ContextMenu.Trigger>
	<ContextMenu.Content class="w-48">
		<ContextMenu.Item onclick={handleCopyModelName}>
			<Copy class="mr-2 h-4 w-4" />
			{m.text_context_copy_name()}
		</ContextMenu.Item>
		<ContextMenu.Item onclick={handleCopyModelId}>
			<Copy class="mr-2 h-4 w-4" />
			{m.text_context_copy_id()}
		</ContextMenu.Item>
		<ContextMenu.Separator />
		<ContextMenu.Item onclick={() => onToggleCollected?.()}>
			<Star
				class={cn(
					"mr-2 h-4 w-4",
					model.collected ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground",
				)}
			/>
			{model.collected ? m.text_button_unstar() : m.text_button_star()}
		</ContextMenu.Item>
		{#if onDuplicate}
			<ContextMenu.Item onclick={handleDuplicate}>
				<Files class="mr-2 h-4 w-4" />
				{m.text_context_duplicate()}
			</ContextMenu.Item>
		{/if}
		<ContextMenu.Separator />
		<ContextMenu.Item onclick={() => onEdit?.()}>
			<PenLine class="mr-2 h-4 w-4" />
			{m.text_button_edit()}
		</ContextMenu.Item>
		<ContextMenu.Item onclick={() => onDelete?.()} class="text-destructive focus:text-destructive">
			<Trash2 class="mr-2 h-4 w-4" />
			{m.text_button_delete()}
		</ContextMenu.Item>
	</ContextMenu.Content>
</ContextMenu.Root>
