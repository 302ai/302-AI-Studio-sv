<script lang="ts">
	import Label from "$lib/components/ui/label/label.svelte";
	import Switch from "$lib/components/ui/switch/switch.svelte";

	interface Props {
		label: string;
		checked?: boolean;
		id?: string;
	}

	let { label, checked = $bindable(false), id }: Props = $props();
</script>

<div
	class="bg-background flex h-11 w-full items-center justify-between rounded-[10px] px-3.5 py-2.5"
>
	<Label for={id}>{label}</Label>
	<Switch {id} bind:checked />
</div>
