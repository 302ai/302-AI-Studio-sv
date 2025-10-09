<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import * as Sidebar from "$lib/components/ui/sidebar";
	import { useSidebar } from "$lib/components/ui/sidebar";
	import { m } from "$lib/paraglide/messages";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
	import { cn } from "$lib/utils";
	import { Ghost, Settings } from "@lucide/svelte";
	import AppSidebar from "./components/app-sidebar.svelte";
	import type { ShortcutActionEvent } from "@shared/types/shortcut";
	import { onMount } from "svelte";

	const { children } = $props();

	async function handleNewSettingsTab() {
		await tabBarState.handleNewTab(
			m.title_settings(),
			"settings",
			true,
			"/settings/general-settings",
		);
	}

	onMount(() => {
		window.electronAPI?.shortcut?.onShortcutAction?.((event: ShortcutActionEvent) => {
			if (event.action === "toggleSidebar") {
				useSidebar().toggle();
			}
		});
	});
</script>

<Sidebar.Provider class="h-full min-h-fit">
	<AppSidebar />

	<Sidebar.Inset class="relative flex-1">
		<div
			class="absolute z-50 flex h-12 w-full flex-row items-center justify-between bg-transparent px-2"
		>
			<ButtonWithTooltip
				tooltip={useSidebar().state === "expanded"
					? m.title_sidebar_close()
					: m.title_sidebar_open()}
				tooltipSide="bottom"
			>
				<Sidebar.Trigger class="hover:!bg-icon-btn-hover size-9 [&_svg]:!size-5" />
			</ButtonWithTooltip>

			<div class="flex flex-row items-center gap-2">
				<ButtonWithTooltip
					class={cn(
						"hover:!bg-icon-btn-hover",
						chatState.isPrivateChatActive && "!bg-icon-btn-active hover:!bg-icon-btn-active",
					)}
					tooltipSide="bottom"
					tooltip={m.title_incognito()}
					onclick={() => chatState.handlePrivateChatActiveChange(!chatState.isPrivateChatActive)}
				>
					<Ghost
						class={cn("size-5", chatState.isPrivateChatActive && "!text-icon-btn-active-fg")}
					/>
				</ButtonWithTooltip>

				<ButtonWithTooltip
					tooltip={m.title_settings()}
					class="hover:!bg-icon-btn-hover"
					tooltipSide="bottom"
					onclick={() => handleNewSettingsTab()}
				>
					<Settings class="size-5" />
				</ButtonWithTooltip>
			</div>
		</div>
		<div class="flex-1 overflow-auto py-6">
			{@render children?.()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
