<script lang="ts" module>
	interface Props {
		tab: Tab;
		isActive: boolean;
		isDragging?: boolean;
		stretch?: boolean;
		closable: boolean;
		offsideClosable: boolean;
		onTabClick: (tabId: string) => void;
		onTabNew: () => void;
		onTabClose: (tabId: string) => void;
		onTabCloseOthers: (tabId: string) => void;
		onTabCloseOffside: (tabId: string) => void;
		onOpenChange: (open: boolean) => void;
		class?: string;
	}

	const COMPACT_THRESHOLD_PX = 64;
</script>

<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as ContextMenu from "$lib/components/ui/context-menu/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
	import { cn } from "$lib/utils";
	import {
		Ghost,
		HatGlasses,
		LayoutGrid,
		MessageCircle,
		MonitorSmartphone,
		Settings,
		X,
	} from "@lucide/svelte";
	import type { Tab } from "@shared/types";
	import { onDestroy } from "svelte";

	const { handleAiApplicationReload } = window.electronAPI.aiApplicationService;
	const { storageService } = window.electronAPI;

	const {
		tab,
		isActive,
		isDragging: _isDragging = false,
		stretch = false,
		closable,
		offsideClosable,
		onTabClick,
		onTabNew,
		onTabClose,
		onTabCloseOthers,
		onTabCloseOffside,
		onOpenChange,
		class: className,
	}: Props = $props();

	let triggerRef = $state<HTMLElement | null>(null);
	let isCompact = $state(false);
	let windowTabsInfo = $derived(tabBarState.windowTabsInfo);
	let hasMessages = $state(false);

	$effect(() => {
		if (!triggerRef?.parentElement) return;

		try {
			const ro = new ResizeObserver((entries) => {
				requestAnimationFrame(() => {
					const entry = entries[0];
					if (entry?.contentRect) {
						isCompact = entry.contentRect.width < COMPACT_THRESHOLD_PX;
					}
				});
			});

			ro.observe(triggerRef.parentElement);
			return () => ro.disconnect();
		} catch (error) {
			console.warn("Error setting up ResizeObserver:", error);
			const width = triggerRef.parentElement.clientWidth;
			isCompact = width < COMPACT_THRESHOLD_PX;
			return;
		}
	});

	// Check if the tab has messages for screenshot functionality
	$effect(() => {
		if (tab.type === "chat" && tab.threadId) {
			(async () => {
				try {
					const messages = await storageService.getItem(`app-chat-messages:${tab.threadId}`);
					hasMessages = Array.isArray(messages) && messages.length > 0;
				} catch (error) {
					console.warn("Failed to check messages for tab:", error);
					hasMessages = false;
				}
			})();
		} else {
			hasMessages = false;
		}
	});

	onDestroy(() => {
		window.cancelAnimationFrame?.(0);
	});

	const handleScreenshot = async () => {
		if (tab.type === "chat" && tab.threadId) {
			// Check if there are messages before taking screenshot
			if (!hasMessages) {
				// Broadcast toast message to tab view (content area) so it displays on top
				// Include threadId so only the current tab shows the toast
				await window.electronAPI?.broadcastService?.broadcastToAll("show-toast", {
					type: "warning",
					message: m.screenshot_no_messages(),
					threadId: tab.threadId,
				});
				return;
			}

			await window.electronAPI?.broadcastService?.broadcastToAll("trigger-screenshot", {
				threadId: tab.threadId,
			});
		}
	};
</script>

{#snippet tabIcon()}
	{@const tabType = tab.type}
	{#if tabType === "chat"}
		{#if tab.incognitoMode}
			<Ghost />
		{:else}
			<MessageCircle />
		{/if}
	{:else if tabType === "settings"}
		<Settings />
	{:else if tabType === "aiApplications"}
		<LayoutGrid />
	{:else if tabType === "codeAgent"}
		<HatGlasses />
	{:else if tabType === "htmlPreview"}
		<MonitorSmartphone />
	{/if}
{/snippet}

<ContextMenu.Root {onOpenChange}>
	<ContextMenu.Trigger
		draggable={true}
		data-tab-draggable
		class={cn(
			"h-tab rounded-[10px] px-tab-x relative flex cursor-pointer items-center text-sm",
			isCompact ? "justify-center" : "gap-tab-gap justify-between",
			stretch ? "min-w-tab-min-w w-auto" : "w-tab-w",
			isActive
				? "bg-tab-active text-tab-fg-active"
				: "bg-tab-inactive text-tab-fg-inactive hover:bg-tab-hover border-transparent",
			"overflow-hidden",
			className,
		)}
		style="app-region: no-drag;"
		onclick={() => onTabClick(tab.id)}
		onauxclick={(e) => {
			if (e.button === 1 && closable) {
				e.preventDefault();
				e.stopPropagation();
				onTabClose(tab.id);
			}
		}}
		title={tab.title}
		role="button"
	>
		<div bind:this={triggerRef} class="contents">
			<div class="mr-tab-icon size-tab-item-icon flex shrink-0 items-center justify-center">
				{@render tabIcon()}
			</div>

			{#if !isCompact}
				<span class="max-w-tab-title min-w-0 flex-1 truncate text-xs">{tab.title}</span>
			{/if}
			{#if closable}
				<Button
					title={isCompact ? tab.title : m.label_button_close()}
					variant="ghost"
					size="icon"
					class={cn(
						"p-tab-close h-auto w-auto shrink-0 rounded bg-transparent transition-colors",
						isActive
							? "hover:bg-tab-btn-hover-active dark:hover:bg-tab-btn-hover-active"
							: "hover:bg-tab-btn-hover-inactive dark:hover:bg-tab-btn-hover-inactive hover:text-tab-btn-hover-fg dark:hover:text-tab-btn-hover-fg",
					)}
					onclick={(e) => {
						e.stopPropagation();
						onTabClose(tab.id);
					}}
				>
					<X class="size-tab-close-icon" />
				</Button>
			{/if}
		</div>
	</ContextMenu.Trigger>
	<ContextMenu.Content class="min-w-48">
		<ContextMenu.Item onSelect={() => onTabNew()}>
			{m.label_button_new_tab()}
		</ContextMenu.Item>

		<ContextMenu.Separator />

		{#if tab.type === "chat"}
			<ContextMenu.Item onSelect={handleScreenshot} disabled={!isActive}>
				{m.screenshot_action()}
			</ContextMenu.Item>
			<ContextMenu.Separator />
		{/if}

		{#if tab.type === "aiApplications"}
			<ContextMenu.Item onSelect={() => handleAiApplicationReload(tab.id)}>
				{m.label_button_reload()}
			</ContextMenu.Item>
			<ContextMenu.Separator />
		{/if}

		{#if windowTabsInfo.length > 0}
			<ContextMenu.Sub>
				<ContextMenu.SubTrigger>
					{m.label_button_move_tab()}
				</ContextMenu.SubTrigger>
				<ContextMenu.SubContent align="start">
					<ContextMenu.Item
						onSelect={() => tabBarState.handleMoveTab(tab.id, "new-window")}
						disabled={tabBarState.tabs.length === 1}
					>
						{m.label_button_open_new_window()}
					</ContextMenu.Item>

					<ContextMenu.Separator />

					{#each windowTabsInfo as { windowId, tabs, firstTabTitle } (windowId)}
						<ContextMenu.Item
							onSelect={() => tabBarState.handleMoveTab(tab.id, "existing-window", windowId)}
						>
							{tabs.length === 1
								? firstTabTitle
								: m.label_button_move_tab_into_existing_window({
										firstTab: firstTabTitle,
										surplus: tabs.length - 1,
									})}
						</ContextMenu.Item>
					{/each}
				</ContextMenu.SubContent>
			</ContextMenu.Sub>
		{:else}
			<ContextMenu.Item
				onSelect={() => tabBarState.handleMoveTab(tab.id, "new-window")}
				disabled={tabBarState.tabs.length === 1}
			>
				{m.label_button_move_tab_into_new_window()}
			</ContextMenu.Item>
		{/if}

		<!-- <ContextMenu.Separator />

		<ContextMenu.Item onSelect={() => {}}>
			{m.label_button_incognito_model()}
		</ContextMenu.Item> -->

		<ContextMenu.Separator />

		<ContextMenu.Item onSelect={() => onTabClose(tab.id)} disabled={!closable}>
			{m.label_button_close()}
		</ContextMenu.Item>

		<ContextMenu.Item onSelect={() => onTabCloseOthers(tab.id)} disabled={!closable}>
			{m.label_button_close_others()}
		</ContextMenu.Item>

		<ContextMenu.Item onSelect={() => onTabCloseOffside(tab.id)} disabled={!offsideClosable}>
			{m.label_button_close_offside()}
		</ContextMenu.Item>
	</ContextMenu.Content>
</ContextMenu.Root>
