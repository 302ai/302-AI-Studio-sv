<script lang="ts" module>
	import type { ModelProvider } from "$lib/types/provider.js";

	interface Props {
		provider: ModelProvider;
		isActive?: boolean;
		onProviderClick?: (provider: ModelProvider) => void;
		onConfigure?: (provider: ModelProvider) => void;
		onRemove?: (provider: ModelProvider) => void;
		class?: string;
	}
</script>

<script lang="ts">
	import { ModelIcon } from "$lib/components/buss/model-icon/index.js";
	import * as ContextMenu from "$lib/components/ui/context-menu/index.js";
	import { providerState } from "$lib/stores/provider-state.svelte.js";
	import { cn } from "$lib/utils";
	import { AlertCircle, Cloud, X } from "@lucide/svelte";
	import { m } from "$lib/paraglide/messages.js";

	let {
		provider,
		isActive = false,
		onProviderClick,
		onConfigure,
		onRemove,
		class: className,
	}: Props = $props();
	const description = $derived.by(() => {
		if (provider.status === "error") {
			return m.text_provider_error();
		}
		if (!provider.apiKey || provider.apiKey.trim() === "") {
			return m.text_provider_not_configured();
		}
		const modelCount = providerState.models.filter((m) => m.providerId === provider.id).length;
		return m.text_provider_models_count({ count: modelCount.toString() });
	});

	const handleConfigure = () => {
		if (onConfigure) {
			onConfigure(provider);
		}
	};

	const handleRemove = () => {
		if (onRemove) {
			onRemove(provider);
		}
	};
</script>

<ContextMenu.Root>
	<ContextMenu.Trigger
		class={cn(
			"relative flex h-provider-item w-full cursor-pointer items-center gap-provider-gap rounded-provider px-provider-x py-provider-y text-sm",
			isActive
				? "bg-tab-active text-tab-fg-active"
				: "bg-tab-inactive text-tab-fg-inactive hover:bg-tab-hover",
			className,
		)}
		onclick={() => onProviderClick?.(provider)}
		role="button"
		tabindex={0}
		aria-label={provider.name}
	>
		<!-- Icon -->
		<div class="flex size-provider-icon shrink-0 items-center justify-center">
			<ModelIcon modelName={provider.icon || provider.apiType} className="h-6 w-6" />
		</div>

		<!-- Content -->
		<div class="min-w-0 flex-1">
			<div class="truncate leading-tight font-medium">
				{provider.name}
			</div>
			<div
				class={cn(
					"mt-0.5 flex items-baseline gap-1 text-xs leading-tight",
					provider.status === "error" ? "text-red-600 dark:text-red-400" : "opacity-70",
				)}
			>
				{#if provider.status === "error"}
					<AlertCircle class="h-3 w-3 shrink-0" />
				{/if}
				<span class="truncate">{description}</span>
			</div>
		</div>
	</ContextMenu.Trigger>
	<ContextMenu.Content class="w-48">
		<ContextMenu.Item onclick={handleConfigure}>
			<Cloud class="mr-2 h-4 w-4" />
			{m.text_context_configure_provider()}
		</ContextMenu.Item>
		<ContextMenu.Item onclick={handleRemove} class="text-destructive focus:text-destructive">
			<X class="mr-2 h-4 w-4" />
			{m.text_context_remove_provider()}
		</ContextMenu.Item>
	</ContextMenu.Content>
</ContextMenu.Root>
