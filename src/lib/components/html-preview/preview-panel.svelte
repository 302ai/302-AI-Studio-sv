<script lang="ts">
	import { onDestroy, onMount } from "svelte";

	interface Props {
		html: string;
		deviceMode?: "desktop" | "mobile";
	}

	let { html, deviceMode = "desktop" }: Props = $props();

	let iframeRef: HTMLIFrameElement | null = $state(null);

	const renderHtmlContent = () => {
		if (!iframeRef || !html) {
			cleanupIframe();
			if (iframeRef) {
				iframeRef.src = "about:blank";
			}
			return;
		}

		cleanupIframe();
		const blob = new Blob([html], { type: "text/html" });
		const url = URL.createObjectURL(blob);
		iframeRef.src = url;
	};

	const cleanupIframe = () => {
		if (iframeRef && iframeRef.src && iframeRef.src.startsWith("blob:")) {
			URL.revokeObjectURL(iframeRef.src);
			iframeRef.src = "about:blank";
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
