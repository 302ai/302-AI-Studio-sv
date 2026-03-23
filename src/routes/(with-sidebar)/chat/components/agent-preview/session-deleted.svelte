<script lang="ts">
	import SessionDeletedIcon from "$lib/assets/icons/code-agent/sessionDeleted.svg";
	import Button from "$lib/components/ui/button/button.svelte";
	import { m } from "$lib/paraglide/messages";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
	import { threadsState } from "$lib/stores/threads-state.svelte";

	async function handleStartNewSession() {
		await tabBarState.handleNewTab(m.title_new_chat());
	}

	async function handleDeleteCurrentConversation() {
		const threadId = chatState.id;

		// Delete thread first (before closing tab, which broadcasts "thread-list-updated")
		const success = await threadsState.deleteThread(threadId);
		if (!success) {
			console.error("Failed to delete thread:", threadId);
			return;
		}

		// Now close the tab — its broadcast will reload threads, but the deleted one is already gone
		const allTabs = await tabBarState.getAllTabs();
		const existingTab = allTabs?.find((tab) => tab.threadId === threadId);
		if (existingTab) {
			await tabBarState.handleTabClose(existingTab.id);
		}
	}
</script>

<div class="flex h-full flex-col items-center justify-start gap-4 pt-20 text-muted-foreground">
	<img src={SessionDeletedIcon} alt="Session deleted" class="h-40 w-40" />
	<p class="text-sm font-medium">{m.text_session_deleted()}</p>

	<div class="flex flex-col gap-3 mt-2">
		<Button onclick={handleStartNewSession} class=" rounded-sm text-sm font-medium text-white ">
			{m.button_start_new_session()}
		</Button>
		<Button
			onclick={handleDeleteCurrentConversation}
			class="rounded-sm text-sm font-medium text-[#FF4D4F] bg-[#FFF1F0] hover:bg-[#FFE4E4] transition-colors"
		>
			{m.button_delete_current_conversation()}
		</Button>
	</div>
</div>
