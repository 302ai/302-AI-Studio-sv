<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import {
		Accordion,
		AccordionContent,
		AccordionItem,
		AccordionTrigger,
	} from "$lib/components/ui/accordion";

	type OpenUIAccordionItem = {
		value: string;
		title: string;
		content?: string;
	};

	type OpenUIAccordionProps = {
		class?: string;
		type?: "single" | "multiple";
		value?: string | string[];
		items?: OpenUIAccordionItem[];
	};

	let { props }: ComponentRenderProps<OpenUIAccordionProps> = $props();
</script>

{#if (props.type ?? "single") === "multiple"}
	<Accordion
		class={props.class}
		type="multiple"
		value={Array.isArray(props.value) ? props.value : []}
	>
		{#each props.items ?? [] as item (item.value)}
			<AccordionItem value={item.value}>
				<AccordionTrigger>{item.title}</AccordionTrigger>
				<AccordionContent>{item.content ?? ""}</AccordionContent>
			</AccordionItem>
		{/each}
	</Accordion>
{:else}
	<Accordion
		class={props.class}
		type="single"
		value={typeof props.value === "string" ? props.value : undefined}
	>
		{#each props.items ?? [] as item (item.value)}
			<AccordionItem value={item.value}>
				<AccordionTrigger>{item.title}</AccordionTrigger>
				<AccordionContent>{item.content ?? ""}</AccordionContent>
			</AccordionItem>
		{/each}
	</Accordion>
{/if}
