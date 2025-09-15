<script lang="ts" module>
	export interface ErrorStateProps {
		message?: string;
	}
</script>

<script lang="ts">
	import { m } from "$lib/paraglide/messages.js";
	import CircleX from "@lucide/svelte/icons/circle-x";

	let { message = m.chat_attachment_viewer_error() }: ErrorStateProps = $props();
</script>

<div class="flex h-full w-full flex-col items-center justify-center">
	<CircleX class="h-8 w-8 text-destructive" />
	<p class="mt-2 text-sm text-muted-foreground">{message}</p>
</div>
