<script lang="ts">
	import { page } from "$app/state";
	import PhrasingForm from "../phrasing-form.svelte";

	const presetId = $derived(page.params.id);
</script>

<PhrasingForm mode="edit" {presetId} />
