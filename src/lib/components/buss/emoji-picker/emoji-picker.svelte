<script lang="ts">
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Popover from "$lib/components/ui/popover/index.js";
	import type { Picker } from "emoji-picker-element";

	interface Props {
		value?: string;
		onSelect?: (emoji: string) => void;
	}

	let { value = $bindable("🔧"), onSelect }: Props = $props();

	let pickerContainer: HTMLDivElement;
	let picker: Picker | null = null;
	let open = $state(false);
	let isLoading = $state(false);

	async function initPicker() {
		if (isLoading || !pickerContainer) return;

		// 如果 picker 已存在且在 DOM 中，不需要重新初始化
		if (picker && pickerContainer.contains(picker)) return;

		// 如果 picker 存在但不在 DOM 中，重新添加
		if (picker && !pickerContainer.contains(picker)) {
			// eslint-disable-next-line svelte/no-dom-manipulating
			pickerContainer.appendChild(picker);
			return;
		}

		// 创建新的 picker
		isLoading = true;
		try {
			const { Picker: EmojiPicker } = await import("emoji-picker-element");
			picker = new EmojiPicker({
				locale: "zh-CN",
				dataSource:
					"https://cdn.jsdelivr.net/npm/emoji-picker-element-data@^1/zh/emojibase/data.json",
			});

			picker.classList.add("emoji-picker-custom");

			picker.addEventListener("emoji-click", (event: Event) => {
				const emojiEvent = event as CustomEvent<{ unicode: string }>;
				const emoji = emojiEvent.detail.unicode;
				value = emoji;
				onSelect?.(emoji);
				open = false;
			});

			// eslint-disable-next-line svelte/no-dom-manipulating
			pickerContainer.appendChild(picker);
		} catch (error) {
			console.error("Failed to load emoji picker:", error);
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		if (open && pickerContainer) {
			initPicker();
		}
	});
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		<Button variant="outline" class="size-10 text-2xl">
			{value}
		</Button>
	</Popover.Trigger>
	<Popover.Content class="w-auto p-0" align="start">
		<div bind:this={pickerContainer}></div>
	</Popover.Content>
</Popover.Root>

<style>
	:global(.emoji-picker-custom) {
		--emoji-size: 1.5rem;
		--num-columns: 8;
		--background: hsl(var(--background));
		--border-color: hsl(var(--border));
		--input-border-color: hsl(var(--input));
		--input-font-color: hsl(var(--foreground));
		--input-placeholder-color: hsl(var(--muted-foreground));
		--button-hover-background: hsl(var(--accent));
		--button-active-background: hsl(var(--accent));
		--indicator-color: hsl(var(--primary));
		--outline-color: hsl(var(--ring));
		border: none;
		max-height: 400px;
	}

	:global(.dark .emoji-picker-custom) {
		--background: hsl(var(--background));
		--border-color: hsl(var(--border));
		--button-hover-background: hsl(var(--accent));
		--button-active-background: hsl(var(--accent));
	}
</style>
