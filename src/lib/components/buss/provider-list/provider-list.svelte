<script lang="ts" module>
	import type { ModelProvider } from "@shared/types";

	interface Props {
		providers: ModelProvider[];
		activeProviderId?: string;
		onProviderClick?: (provider: ModelProvider) => void;
		onReorder?: (providers: ModelProvider[]) => void;
		onConfigure?: (provider: ModelProvider) => void;
		onRemove?: (provider: ModelProvider) => void;
		class?: string;
	}
</script>

<script lang="ts">
	import { DraggableList } from "$lib/components/buss/draggable-list";
	import { m } from "$lib/paraglide/messages";
	import ProviderItem from "./provider-item.svelte";

	let {
		providers = $bindable<ModelProvider[]>(),
		activeProviderId = $bindable<string>(),
		onProviderClick,
		onReorder,
		onConfigure,
		onRemove,
		class: className,
	}: Props = $props();
</script>

<DraggableList
	bind:items={providers}
	bind:activeId={activeProviderId}
	onItemClick={onProviderClick}
	{onReorder}
	class={className}
	aria-label={m.title_model_providers()}
>
	{#snippet children(provider: ModelProvider, isActive: boolean)}
		<ProviderItem {provider} {isActive} {onProviderClick} {onConfigure} {onRemove} />
	{/snippet}
</DraggableList>
