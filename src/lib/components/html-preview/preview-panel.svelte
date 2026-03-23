<script lang="ts">
	import { m } from "$lib/paraglide/messages";
	import { onDestroy } from "svelte";

	interface Props {
		html: string;
		deviceMode?: "desktop" | "mobile";
	}

	let { html, deviceMode = "desktop" }: Props = $props();

	let iframeRef: HTMLIFrameElement | null = $state(null);
	let currentBlobUrl: string | null = null;

	/*
	 * Render content into iframe
	 * Re-runs whenever html or iframeRef changes
	 */
	$effect(() => {
		// Clean up previous blob URL first
		if (currentBlobUrl) {
			URL.revokeObjectURL(currentBlobUrl);
			currentBlobUrl = null;
		}

		if (!iframeRef) return;

		if (!html) {
			iframeRef.src = "about:blank";
			return;
		}

		// Create and set new blob URL
		const blob = new Blob([html], { type: "text/html" });
		const url = URL.createObjectURL(blob);
		currentBlobUrl = url;
		iframeRef.src = url;
	});

	onDestroy(() => {
		if (currentBlobUrl) {
			URL.revokeObjectURL(currentBlobUrl);
			currentBlobUrl = null;
		}
		if (iframeRef) {
			iframeRef.src = "about:blank";
		}
	});
</script>

<div class="w-full h-full flex items-start justify-center overflow-auto bg-muted/30">
	<div
		class="h-full w-full transition-all duration-300 ease-in-out mx-auto {deviceMode === 'mobile'
			? 'max-w-[375px]'
			: ''}"
	>
		<iframe
			bind:this={iframeRef}
			class="w-full h-full border-0 {deviceMode === 'mobile'
				? 'shadow-lg border-x border-border'
				: ''}"
			sandbox="allow-same-origin allow-scripts allow-downloads"
			referrerpolicy="no-referrer"
			title={m.title_html_preview()}
		></iframe>
	</div>
</div>
