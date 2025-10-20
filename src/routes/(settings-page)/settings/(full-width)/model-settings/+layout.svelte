<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { ProviderList } from "$lib/components/buss/provider-list";
	import { m } from "$lib/paraglide/messages.js";
	import { persistedProviderState, providerState } from "$lib/stores/provider-state.svelte.js";
	import type { ModelProvider } from "@shared/storage/provider";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";
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

	async function handleRemoveProvider(provider: ModelProvider) {
		if (!provider.custom) {
			toast.error(m.text_provider_remove_builtin_error());
			return;
		}
		await providerState.removeProvider(provider.id);

		const removedModelCount = await providerState.removeModelsByProvider(provider.id);

		toast.success(
			`${m.text_context_remove_provider()}: ${provider.name}${removedModelCount > 0 ? ` (${removedModelCount} models removed)` : ""}`,
		);
		if (provider.id === activeProviderId && persistedProviderState.current.length > 0) {
			goto(`/settings/model-settings/${persistedProviderState.current[0].id}`);
		}
	}

	onMount(() => {
		if (!page.params.provider && persistedProviderState.current.length > 0) {
			goto(`/settings/model-settings/${persistedProviderState.current[0].id}`);
		}
	});
</script>

<div class="flex size-full overflow-hidden">
	<div class="flex h-full w-56 flex-shrink-0 flex-col border-r">
		<div class="flex-shrink-0 p-4">
			<Header onClick={handleAddProvider} />
		</div>
		<div class="min-h-0 flex-1 overflow-auto">
			<div class="h-full px-4 pb-4">
				<ProviderList
					bind:providers={persistedProviderState.current}
					bind:activeProviderId
					onProviderClick={handleProviderClick}
					onReorder={handleReorderProviders}
					onConfigure={handleConfigureProvider}
					onRemove={handleRemoveProvider}
					class="h-full"
				/>
			</div>
		</div>
	</div>

	<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
		{@render children()}
	</div>
</div>
