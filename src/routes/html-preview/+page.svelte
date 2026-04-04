<script lang="ts">
	import PreviewPanel from "$lib/components/html-preview/preview-panel.svelte";
	import * as m from "$lib/paraglide/messages";
	import { persistedTabState } from "$lib/stores/tab-bar-state.svelte";
	import { createLogger } from "@shared/logger";

	const logger = createLogger("ui");

	let deviceMode = $state<"desktop" | "mobile">("desktop");

	// Get current window's tabs from persisted state
	let windowId = $state(window.windowId);
	const currentWindowTabs = $derived(persistedTabState.current[windowId]?.tabs ?? []);
	const activeTab = $derived(currentWindowTabs.find((tab) => tab.active));

	// Reactively get HTML content from active tab
	const rawHtmlContent = $derived(
		activeTab?.type === "htmlPreview" && activeTab?.content ? activeTab.content : "",
	);

	// Cache content to prevent flickering during tab switching and window migration
	// Always keep the last valid content to display during transitions
	let cachedHtmlContent = $state("");

	$effect(() => {
		// Only update cache when we have valid content
		if (rawHtmlContent) {
			cachedHtmlContent = rawHtmlContent;
		}
	});

	// Always prefer raw content, fallback to cached content to prevent flickering
	const htmlContent = $derived(rawHtmlContent || cachedHtmlContent);

	$effect(() => {
		const handleWindowIdChanged = (event: Event) => {
			const customEvent = event as CustomEvent<{ newWindowId: string }>;
			logger.info("windowIdChanged event received:", customEvent.detail.newWindowId);

			windowId = customEvent.detail.newWindowId;

			// Force refresh state to ensure we have the latest data for the new window
			persistedTabState.refresh();
		};

		window.addEventListener("windowIdChanged", handleWindowIdChanged);

		return () => {
			window.removeEventListener("windowIdChanged", handleWindowIdChanged);
		};
	});
</script>

<div class="h-full w-full flex flex-col bg-background">
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
				</div>
			</div>
		{/if}
	</div>
</div>
