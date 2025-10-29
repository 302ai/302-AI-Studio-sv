<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { htmlPreviewState } from "$lib/stores/html-preview-state.svelte";
	import { Monitor, X } from "@lucide/svelte";
	import { onDestroy, onMount } from "svelte";

	let iframeRef: HTMLIFrameElement | null = $state(null);

	const renderHtmlContent = () => {
		if (!htmlPreviewState.currentHtml || !iframeRef) return;

		const html = htmlPreviewState.currentHtml;
		const blob = new Blob([html], { type: "text/html" });
		const url = URL.createObjectURL(blob);
		iframeRef.src = url;
	};

	const cleanupIframe = () => {
		if (iframeRef && iframeRef.src) {
			URL.revokeObjectURL(iframeRef.src);
		}
	};

	$effect(() => {
		renderHtmlContent();
	});

	onMount(() => {
		return () => {
			cleanupIframe();
		};
	});

	onDestroy(() => {
		cleanupIframe();
	});
</script>

{#if htmlPreviewState.isVisible}
	<div class="h-full border-l border-border bg-background flex flex-col">
		<div
			class="flex items-center justify-between px-4 py-3 border-b border-border bg-muted shrink-0"
		>
			<div class="flex items-center gap-2">
				<Monitor class="h-4 w-4 text-muted-foreground" />
				<span class="text-sm font-medium text-muted-foreground">HTML Preview</span>
			</div>
			<Button
				variant="ghost"
				size="sm"
				onclick={() => htmlPreviewState.closePreview()}
				class="h-8 w-8 p-0 hover:bg-background/80"
				title="Close preview"
			>
				<X class="h-4 w-4" />
			</Button>
		</div>

		<div class="flex-1 overflow-auto">
			<iframe
				bind:this={iframeRef}
				class="w-full h-full border-0"
				sandbox="allow-same-origin allow-scripts"
				referrerpolicy="no-referrer"
				title="HTML Preview"
			></iframe>
		</div>
	</div>
{/if}
