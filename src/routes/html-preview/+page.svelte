<script lang="ts">
	import * as m from "$lib/paraglide/messages";
	import PreviewPanel from "$lib/components/html-preview/preview-panel.svelte";
	import { persistedTabState } from "$lib/stores/tab-bar-state.svelte";

	let deviceMode = $state<"desktop" | "mobile">("desktop");

	// Get current window's tabs from persisted state
	const windowId = window.windowId;
	const currentWindowTabs = $derived(persistedTabState.current[windowId]?.tabs ?? []);
	const activeTab = $derived(currentWindowTabs.find((tab) => tab.active));

	// Reactively get HTML content from active tab
	const htmlContent = $derived(
		activeTab?.type === "htmlPreview" && activeTab?.content ? activeTab.content : "",
	);
</script>

<div class="h-full w-full flex flex-col bg-background">
	<!-- Simple toolbar -->
	<!-- <div class="flex h-12 items-center justify-between border-b border-border px-4 bg-background">
			<h1 class="text-lg font-semibold">HTML Preview</h1>
			<div class="flex items-center gap-2">
				<button
					type="button"
					class="px-3 py-1.5 text-sm rounded-md transition-colors {deviceMode === 'desktop'
						? 'bg-primary text-primary-foreground'
						: 'bg-muted hover:bg-muted/80'}"
					onclick={() => (deviceMode = "desktop")}
				>
					Desktop View
				</button>
				<button
					type="button"
					class="px-3 py-1.5 text-sm rounded-md transition-colors {deviceMode === 'mobile'
						? 'bg-primary text-primary-foreground'
						: 'bg-muted hover:bg-muted/80'}"
					onclick={() => (deviceMode = "mobile")}
				>
					Mobile View
				</button>
			</div>
		</div> -->

	<!-- Preview content -->
	<div class="flex-1 overflow-hidden">
		{#if htmlContent.length > 0}
			<PreviewPanel html={htmlContent} {deviceMode} />
		{:else}
			<div class="h-full flex items-center justify-center">
				<div class="text-center space-y-3">
					<div class="text-6xl">📄</div>
					<div class="text-lg font-medium text-muted-foreground">
						{m.empty_html_preview_title()}
					</div>
					<div class="text-sm text-muted-foreground">{m.empty_html_preview_description()}</div>
				</div>
			</div>
		{/if}
	</div>
</div>
