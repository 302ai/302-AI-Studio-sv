<script lang="ts">
	import { m } from "$lib/paraglide/messages.js";
	import LdrsLoader from "../../ldrs-loader/ldrs-loader.svelte";

	interface Props {
		type: "todo" | "write";
	}

	const props: Props = $props();
</script>

<div class="flex py-2">
	<div class="flex items-center gap-2 text-sm text-muted-foreground">
		<LdrsLoader type="line-spinner" size={16} />
		{#if props.type === "todo"}
			<span>{m.detecting_todo_list()}</span>
		{:else if props.type === "write"}
			<span>{m.detecting_write_tool()}</span>
		{/if}
	</div>
</div>
