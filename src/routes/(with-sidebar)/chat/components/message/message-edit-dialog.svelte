<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as Dialog from "$lib/components/ui/dialog";
	import { Textarea } from "$lib/components/ui/textarea";
	import { m } from "$lib/paraglide/messages";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { RefreshCcw } from "@lucide/svelte";

	interface Props {
		open: boolean;
		editContent: string;
		originalContent: string;
		showRegenerateButton: boolean;
		onCancel: () => void;
		onConfirm: () => void;
		onRegenerate: () => void;
		onContentChange: (value: string) => void;
	}

	let {
		open = $bindable(),
		editContent,
		originalContent,
		showRegenerateButton,
		onCancel,
		onConfirm,
		onRegenerate,
		onContentChange,
	}: Props = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="p-4">
		<Dialog.Header>
			<Dialog.Title>{m.text_edit()}</Dialog.Title>
		</Dialog.Header>

		<Textarea
			value={editContent}
			oninput={(e) => onContentChange(e.currentTarget.value)}
			rows={8}
			class="max-h-128 min-h-40 w-[512px] resize-none border-border"
		/>

		<Dialog.Footer class="flex !justify-between">
			<Button variant="outline" onclick={onCancel} class="!border-border hover:!border-border/80">
				{m.text_button_cancel()}
			</Button>
			<div class="flex gap-2">
				{#if showRegenerateButton}
					<Button
						variant="secondary"
						onclick={onRegenerate}
						disabled={!chatState.canRegenerate ||
							chatState.isStreaming ||
							editContent.trim() === ""}
					>
						<RefreshCcw class="mr-2 h-4 w-4" />
						{m.title_regenerate()}
					</Button>
				{/if}
				<Button
					variant="default"
					onclick={onConfirm}
					disabled={editContent.trim() === originalContent}
				>
					{m.text_button_confirm_edit()}
				</Button>
			</div>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
