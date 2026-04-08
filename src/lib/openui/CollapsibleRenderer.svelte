<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger,
	} from "$lib/components/ui/collapsible";
	import { Button } from "$lib/components/ui/button";

	type OpenUICollapsibleProps = {
		open?: boolean;
		label?: string;
		content?: string;
		class?: string;
	};

	let { props }: ComponentRenderProps<OpenUICollapsibleProps> = $props();
</script>

<Collapsible open={props.open} class={props.class}>
	<CollapsibleTrigger>
		{#snippet child({ props: triggerProps })}
			<Button {...triggerProps} variant="outline">{props.label ?? "Toggle"}</Button>
		{/snippet}
	</CollapsibleTrigger>
	<CollapsibleContent class="pt-3 text-sm">{props.content ?? ""}</CollapsibleContent>
</Collapsible>
