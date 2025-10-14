<script lang="ts">
	import { page } from "$app/state";
	import McpServerForm from "$lib/components/buss/mcp-server-form/mcp-server-form.svelte";

	const serverId = $derived(page.params.id);
</script>

<McpServerForm mode="edit" {serverId} />
