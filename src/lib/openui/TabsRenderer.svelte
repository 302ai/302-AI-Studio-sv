<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";

	type OpenUITabItem = {
		value: string;
		label: string;
		content?: string;
	};

	type OpenUITabsProps = {
		class?: string;
		value?: string;
		items?: OpenUITabItem[];
	};

	let { props }: ComponentRenderProps<OpenUITabsProps> = $props();
</script>

<Tabs class={props.class} value={props.value ?? props.items?.[0]?.value ?? ""}>
	<TabsList>
		{#each props.items ?? [] as item (item.value)}
			<TabsTrigger value={item.value}>{item.label}</TabsTrigger>
		{/each}
	</TabsList>

	{#each props.items ?? [] as item (item.value)}
		<TabsContent value={item.value}>
			{item.content ?? ""}
		</TabsContent>
	{/each}
</Tabs>
