<script lang="ts" module>
	export interface ViewerBaseProps {
		children: import("svelte").Snippet;
		class?: string;
	}
</script>

<script lang="ts">
	import { cn } from "$lib/utils";

	let { children, class: className }: ViewerBaseProps = $props();
</script>

<div
	class={cn(
		"bg-chat-attachment-viewer rounded-b-[10px]",
		"user-select-none relative h-full w-full",
		className,
	)}
>
	{@render children()}
</div>
