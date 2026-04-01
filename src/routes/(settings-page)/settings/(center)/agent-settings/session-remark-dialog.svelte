<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as Dialog from "$lib/components/ui/dialog";
	import { m } from "$lib/paraglide/messages";
	import { Loader2 } from "@lucide/svelte";

	interface Props {
		open?: boolean;
		sessionId?: string;
		remark?: string;
		onSave?: (remark: string) => Promise<void>;
		onClose?: () => void;
	}

	let {
		open = $bindable(false),
		sessionId = "",
		remark = "",
		onSave = async () => {},
		onClose = () => {},
	}: Props = $props();

	let editedRemark = $state(remark);
	let isSaving = $state(false);

	$effect(() => {
		if (open) {
			editedRemark = remark;
		}
	});

	async function handleSave() {
		isSaving = true;
		try {
			await onSave(editedRemark);
			open = false;
		} finally {
			isSaving = false;
		}
	}

	function handleClose() {
		if (isSaving) return;
		onClose();
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="min-w-[569px] rounded-2xl bg-[#F7F8FA] p-6 dark:bg-neutral-900">
		<Dialog.Header>
			<Dialog.Title>{m.title_rename()}</Dialog.Title>
		</Dialog.Header>

		<!-- Content -->
		<div class="mt-2 rounded-xl bg-white p-5 dark:bg-neutral-800">
			<!-- 会话ID -->
			<div class="mb-4">
				<div class="mb-2 text-sm font-medium text-foreground">
					{m.title_session_id()}
				</div>
				<div class="text-sm text-muted-foreground">{sessionId}</div>
			</div>

			<!-- 备注输入 -->
			<div class="mb-6">
				<div class="mb-2 text-sm font-medium text-foreground">
					{m.label_remark()}
				</div>
				<input
					type="text"
					bind:value={editedRemark}
					disabled={isSaving}
					class="w-full rounded-lg border border-input bg-[#F5F5F5] px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary dark:bg-neutral-700"
				/>
			</div>

			<!-- Buttons -->
			<div class="flex justify-between">
				<Button
					variant="outline"
					class="rounded-lg"
					onclick={handleClose}
					disabled={isSaving}
				>
					{m.text_button_cancel()}
				</Button>
				<Button
					class="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
					onclick={handleSave}
					disabled={isSaving}
				>
					{#if isSaving}
						<Loader2 class="h-4 w-4 animate-spin" />
					{/if}
					{m.text_button_save()}
				</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
