<script lang="ts">
	import { onDestroy, onMount } from "svelte";

	interface Props {
		html: string;
		deviceMode?: "desktop" | "mobile";
	}

	let { html, deviceMode = "desktop" }: Props = $props();

	let iframeRef: HTMLIFrameElement | null = $state(null);
	let currentBlobUrl: string | null = null;

	const renderHtmlContent = () => {
		if (!iframeRef || !html) {
			if (currentBlobUrl) {
				URL.revokeObjectURL(currentBlobUrl);
				currentBlobUrl = null;
			}
			if (iframeRef) {
				iframeRef.src = "about:blank";
			}
			return;
		}

		// Clean up previous blob URL if it exists
		if (currentBlobUrl) {
			URL.revokeObjectURL(currentBlobUrl);
		}

		// Create and set new blob URL
		const blob = new Blob([html], { type: "text/html" });
		const url = URL.createObjectURL(blob);
		currentBlobUrl = url;
		iframeRef.src = url;
	};

	const cleanupIframe = () => {
		if (currentBlobUrl) {
			URL.revokeObjectURL(currentBlobUrl);
			currentBlobUrl = null;
		}
		if (iframeRef) {
			iframeRef.src = "about:blank";
		}
	};

	$effect(() => {
		renderHtmlContent();
	});

	$effect.pre(() => {
		// Trigger render when html changes
		void html;
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
			sandbox="allow-same-origin allow-scripts"
			referrerpolicy="no-referrer"
			title="HTML Preview"
		></iframe>
	</div>
</div>
