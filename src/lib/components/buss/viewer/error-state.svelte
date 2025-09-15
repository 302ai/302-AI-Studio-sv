<script lang="ts" module>
	export interface ErrorStateProps {
		message?: string;
	}
</script>

<script lang="ts">
	import { m } from "$lib/paraglide/messages.js";
	import CircleX from "@lucide/svelte/icons/circle-x";

	const { message = m.chat_attachment_viewer_error() }: ErrorStateProps = $props();
</script>

<div class="flex h-full w-full flex-col items-center justify-center">
	<CircleX class="text-destructive h-8 w-8" />
	<p class="text-muted-foreground mt-2 text-sm">{message}</p>
</div>
