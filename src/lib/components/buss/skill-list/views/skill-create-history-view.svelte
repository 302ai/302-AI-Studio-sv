<script lang="ts">
	import Button from "$lib/components/ui/button/button.svelte";
	import { m } from "$lib/paraglide/messages";
	import { skillsPanelState } from "$lib/stores/skills-panel-state.svelte";
	import { toast } from "svelte-sonner";
	import SkillHistoryForm from "../skill-history-form.svelte";
	import { createLogger } from "@shared/logger";

	const logger = createLogger("ui");

	let historyFormRef = $state<SkillHistoryForm | undefined>();
	let isCreating = $state(false);

	async function handleCreate() {
		if (!historyFormRef?.validate()) return;

		const selected = historyFormRef.getSelectedConversation();
		if (!selected) return;

		isCreating = true;
		try {
			const { sandboxId, sessionId } = selected;

			// 1. 根据 sessionId 查找 threadId
			const { isOK, threadId } = await window.electronAPI.codeAgentService.getThreadIdBySessionId(
				sandboxId,
				sessionId,
			);

			if (!isOK || !threadId) {
				toast.error(m.skills_history_thread_not_found());
				return;
			}

			// 2. 获取当前窗口 ID
			const currentWindowId = window.windowId || undefined;

			// 3. 导航到 thread
			const result = await window.electronAPI.windowService.navigateToThread(
				threadId,
				currentWindowId,
			);

			if (result.success) {
				// Trigger the summary message in the target thread
				setTimeout(() => {
					window.electronAPI.tabService.triggerCreateSkillSummary(threadId);
				}, 1000);

				skillsPanelState.reset();
			} else {
				toast.error(m.skills_history_navigate_failed());
			}
		} catch (error) {
			logger.error("Failed to navigate to history thread:", error);
			toast.error(m.skills_history_navigate_failed());
		} finally {
			isCreating = false;
		}
	}

	function handleCancel() {
		skillsPanelState.pop();
	}
</script>

<div class="flex flex-col h-full">
	<div class="flex-1 overflow-y-auto min-h-0">
		<SkillHistoryForm bind:this={historyFormRef} />
	</div>

	<div class="flex gap-3 border-t px-6 py-4">
		<Button variant="outline" class="flex-1" onclick={handleCancel} disabled={isCreating}>
			{m.text_button_cancel()}
		</Button>
		<Button
			class="flex-1 bg-violet-500 hover:bg-violet-600"
			onclick={handleCreate}
			disabled={isCreating}
		>
			{isCreating ? m.skills_creating() : m.text_button_confirm()}
		</Button>
	</div>
</div>
