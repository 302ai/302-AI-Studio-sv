<script lang="ts" module>
	interface Props {
		value?: string;
		onChange: (iconKey: string) => void;
		class?: string;
	}
</script>

<script lang="ts">
	import { ModelIcon } from "$lib/components/buss/model-icon/index.js";
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { cn } from "$lib/utils";
	import { FileImage } from "@lucide/svelte";

	let { value, onChange, class: className }: Props = $props();
	let isOpen = $state(false);

	const aiIcons = [
		{ name: "302.AI", key: "ai302" },
		{ name: "OpenAI", key: "openai" },
		{ name: "Anthropic", key: "anthropic" },
		{ name: "Claude", key: "claude" },
		{ name: "Google", key: "google" },
		{ name: "Gemini", key: "gemini" },
		{ name: "Meta", key: "meta" },
		{ name: "Azure", key: "azure" },
		{ name: "Baidu", key: "baidu" },
		{ name: "Qwen", key: "qwen" },
		{ name: "ChatGLM", key: "zhipu" },
		{ name: "DeepSeek", key: "deepseek" },
		{ name: "Doubao", key: "doubao" },
		{ name: "Moonshot", key: "moonshot" },
		{ name: "MiniMax", key: "minimax" },
		{ name: "Mistral", key: "mistral" },
		{ name: "Hugging Face", key: "huggingface" },
		{ name: "Replicate", key: "replicate" },
		{ name: "Cohere", key: "cohere" },
		{ name: "Ollama", key: "ollama" },
		{ name: "Groq", key: "groq" },
		{ name: "Perplexity", key: "perplexity" },
		{ name: "OpenRouter", key: "openrouter" },
	];

	const selectedIcon = $derived(value ? aiIcons.find((icon) => icon.key === value) : null);

	function handleIconSelect(iconKey: string) {
		onChange(iconKey);
		isOpen = false;
	}
</script>

<Popover.Root bind:open={isOpen}>
	<Popover.Trigger
		class={cn(
			"flex size-11 items-center justify-center rounded-lg bg-muted transition-colors hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
			className,
		)}
	>
		{#if selectedIcon}
			<ModelIcon modelName={selectedIcon.key} className="h-6 w-6" />
		{:else}
			<FileImage class="h-4 w-4 text-muted-foreground" />
		{/if}
	</Popover.Trigger>

	<Popover.Content class="w-80 p-0">
		<div class="h-64 overflow-y-auto p-2">
			<div class="grid grid-cols-4 gap-3">
				{#each aiIcons as iconItem (iconItem.key)}
					<button
						type="button"
						onclick={() => handleIconSelect(iconItem.key)}
						class={cn(
							"flex flex-col items-center rounded p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
							value === iconItem.key && "bg-primary/10 text-primary ring-2 ring-primary/20",
						)}
						title={iconItem.name}
					>
						<ModelIcon modelName={iconItem.key} className="mb-1 h-8 w-8" />
						<span class="w-full truncate text-center text-xs">
							{iconItem.name}
						</span>
					</button>
				{/each}
			</div>
		</div>
	</Popover.Content>
</Popover.Root>
