<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as Dialog from "$lib/components/ui/dialog";
	import { Input } from "$lib/components/ui/input";
	import { m } from "$lib/paraglide/messages";

	interface Props {
		open: boolean;
		initialValue: string;
		onClose: () => void;
		onConfirm: (value: string) => void;
	}

	let { open = $bindable(), initialValue, onClose, onConfirm }: Props = $props();
	let name = $state(initialValue);

	$effect(() => {
		if (open) {
			name = initialValue;
		} else {
			onClose();
		}
	});

	function handleCancel() {
		open = false;
	}

	function handleConfirm() {
		const trimmed = name.trim();
		if (!trimmed) return;
		onConfirm(trimmed);
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="min-w-[512px]">
		<Dialog.Header>
			<Dialog.Title>{m.title_rename()}</Dialog.Title>
			<Dialog.Description>{m.text_description_rename()}</Dialog.Description>
		</Dialog.Header>

		<Input
			bind:value={name}
			class="border-border !bg-background"
			placeholder={m.placeholder_input_rename()}
		/>

		<Dialog.Footer class="flex sm:justify-between">
			<Button variant="secondary" onclick={handleCancel}>{m.text_button_cancel()}</Button>
			<Button variant="default" onclick={handleConfirm} disabled={!name.trim()}
				>{m.text_button_save()}</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
