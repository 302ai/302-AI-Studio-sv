<script lang="ts">
	import { Switch } from "$lib/components/ui/switch";

	interface Props {
		label: string;
		id?: string;
		checked?: boolean;
	}

	let { label, id = crypto.randomUUID(), checked = $bindable(false) }: Props = $props();

	function handleCheckedChange(newChecked: boolean) {
		checked = newChecked;
	}
</script>

<div
	class="h-settings-item rounded-settings-item bg-settings-item-bg px-settings-item-x py-settings-item-y flex w-full items-center justify-between"
>
	<label for={id} class="text-sm">{label}</label>
	<Switch
		{id}
		class="data-[state=unchecked]:border-settings-switch-border"
		{checked}
		onCheckedChange={handleCheckedChange}
	/>
</div>
