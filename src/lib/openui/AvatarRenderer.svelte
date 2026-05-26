<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import { Avatar, AvatarFallback, AvatarImage } from "$lib/components/ui/avatar";

	type OpenUIAvatarProps = {
		class?: string;
		src?: string;
		alt?: string;
		fallback?: string;
	};

	let { props }: ComponentRenderProps<OpenUIAvatarProps> = $props();
</script>

<Avatar class={props.class}>
	{#if props.src}
		<AvatarImage src={props.src} alt={props.alt} />
	{/if}
	<AvatarFallback>{props.fallback ?? "?"}</AvatarFallback>
</Avatar>
