<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import * as Sidebar from "$lib/components/ui/sidebar";
	import { useSidebar } from "$lib/components/ui/sidebar";
	import { m } from "$lib/paraglide/messages";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { cn } from "$lib/utils";
	import { Ghost, Settings } from "@lucide/svelte";
	import { fly } from "svelte/transition";
	import AppSidebar from "./components/app-sidebar.svelte";
	import SidebarShortcutHandler from "./components/sidebar-shortcut-handler.svelte";

	const { children } = $props();

	async function handleNewSettingsTab() {
		await window.electronAPI.windowService.handleOpenSettingsWindow();
	}
</script>

<Sidebar.Provider class="h-full min-h-fit">
	<!-- Handle sidebar shortcuts - must be inside Provider to access context -->
	<SidebarShortcutHandler />

	<AppSidebar />

	<Sidebar.Inset class="relative flex-1">
		<div
			class="absolute z-50 flex h-12 w-full flex-row items-center justify-between bg-transparent px-2"
			transition:fly={{ y: -10, duration: 500 }}
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
					tooltip={chatState.canTogglePrivacy ? m.title_incognito() : m.title_incognito_disabled()}
					disabled={!chatState.canTogglePrivacy}
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
		<div class="flex-1 overflow-auto py-6" transition:fly={{ y: 20, duration: 800 }}>
			{@render children?.()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
