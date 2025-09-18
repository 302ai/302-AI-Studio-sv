<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { ProviderList } from "$lib/components/buss/provider-list";
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import { providerState } from "$lib/stores/provider-state.svelte.js";
	import type { ModelProvider } from "$lib/types/provider";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";
	import { m } from "$lib/paraglide/messages.js";
	import Header from "./header.svelte";

	const { children } = $props();
	let activeProviderId = $state<string>();
	$effect(() => {
		const currentProvider = page.params.provider;
		if (currentProvider) {
			const provider = providerState.getProviderByNameOrId(currentProvider);
			if (provider) {
				activeProviderId = provider.id;
			}
		}
	});

	function handleProviderClick(provider: ModelProvider) {
		activeProviderId = provider.id;
		goto(`/settings/model-settings/${provider.id}`);
	}

	function handleAddProvider() {
		const newProvider = providerState.createCustomProvider();
		providerState.addProvider(newProvider);
		activeProviderId = newProvider.id;
		goto(`/settings/model-settings/${newProvider.id}`);
	}

	function handleReorderProviders(newOrder: ModelProvider[]) {
		providerState.reorderProviders(newOrder);
	}

	function handleConfigureProvider(provider: ModelProvider) {
		goto(`/settings/model-settings/${provider.id}`);
	}

	function handleRemoveProvider(provider: ModelProvider) {
		if (!provider.custom) {
			toast.error(m.text_provider_remove_builtin_error());
			return;
		}
		providerState.removeProvider(provider.id);

		const removedModelCount = providerState.removeModelsByProvider(provider.id);

		toast.success(
			`${m.text_context_remove_provider()}: ${provider.name}${removedModelCount > 0 ? ` (${removedModelCount} models removed)` : ""}`,
		);
		if (provider.id === activeProviderId && providerState.providers.length > 0) {
			goto(`/settings/model-settings/${providerState.providers[0].id}`);
		}
	}

	onMount(() => {
		if (!page.params.provider && providerState.providers.length > 0) {
			goto(`/settings/model-settings/${providerState.providers[0].id}`);
		}
	});
</script>

<div class="flex size-full overflow-hidden">
	<div class="flex h-full w-80 flex-shrink-0 flex-col border-r">
		<div class="flex-shrink-0 p-4">
			<Header onClick={handleAddProvider} />
		</div>
		<div class="min-h-0 flex-1">
			<ScrollArea class="h-full">
				<div class="h-full px-4 pb-4">
					<ProviderList
						bind:providers={providerState.providers}
						bind:activeProviderId
						onProviderClick={handleProviderClick}
						onReorder={handleReorderProviders}
						onConfigure={handleConfigureProvider}
						onRemove={handleRemoveProvider}
						class="h-full"
					/>
				</div>
			</ScrollArea>
		</div>
	</div>

	{@render children()}
</div>
