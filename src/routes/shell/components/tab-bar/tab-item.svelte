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
	import OpenClawRaw from "$lib/assets/icons/code-agent/openclaw.svg?raw";
	import { Button } from "$lib/components/ui/button";
	import * as ContextMenu from "$lib/components/ui/context-menu/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
	import { threadBusyState } from "$lib/stores/thread-busy-state.svelte";
	import { cn } from "$lib/utils";
	import ClaudeCodeRaw from "@lobehub/icons-static-svg/icons/claudecode.svg?raw";
	import {
		Ghost,
		HatGlasses,
		LayoutGrid,
		LoaderCircle,
		MessageCircle,
		MessageCircleQuestionMark,
		MonitorSmartphone,
		Settings,
		ShoppingBag,
		X,
	} from "@lucide/svelte";
	import { createLogger } from "@shared/logger";
	import { isChatTab } from "@shared/storage/tab";
	import type { Tab } from "@shared/types";
	import { onDestroy } from "svelte";

	const logger = createLogger("ui");

	const { handleAiApplicationReloadIpc } = window.electronAPI.aiApplicationService;
	const { openExternalLink } = window.electronAPI.externalLinkService;

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
	let displayTitle = $derived.by(() => {
		if (threadBusyState.getReason(tab.threadId) === "generating-title") {
			return m.label_generating_title();
		}
		return tab.title;
	});

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
			logger.warn("Error setting up ResizeObserver:", error);
			const width = triggerRef.parentElement.clientWidth;
			isCompact = width < COMPACT_THRESHOLD_PX;
			return;
		}
	});

	onDestroy(() => {
		window.cancelAnimationFrame?.(0);
	});

	const handleScreenshot = async () => {
		if (isChatTab(tab.type) && tab.threadId) {
			await window.electronAPI?.broadcastService.broadcastToAll("trigger-screenshot", {
				threadId: tab.threadId,
			});
		}
	};

	const handleOpenInBrowser = async () => {
		await openExternalLink(tab.href);
	};

	const handleRefresh = async () => {
		if (tab.type === "openClawWebUi") {
			await window.electronAPI.openClawService.handleOpenClawWebUiReloadIpc(tab.id);
			return;
		}

		await handleAiApplicationReloadIpc(tab.id);
	};
</script>

{#snippet tabIcon()}
	{@const tabType = tab.type}
	{#if isChatTab(tabType) && threadBusyState.isBusy(tab.threadId)}
		<LoaderCircle class="animate-spin" />
	{:else if tabType === "chat"}
		{#if tab.incognitoMode}
			<Ghost />
		{:else}
			<MessageCircle />
		{/if}
	{:else if tabType === "chat-vibe-claude"}
		<span class="flex h-4 w-4 items-center justify-center [&>svg]:h-full [&>svg]:w-full">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html ClaudeCodeRaw}
		</span>
	{:else if tabType === "chat-vibe-openclaw"}
		<span class="flex h-4 w-4 items-center justify-center [&>svg]:h-full [&>svg]:w-full">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html OpenClawRaw}
		</span>
	{:else if tabType === "settings"}
		<Settings />
	{:else if tabType === "aiApplications"}
		<LayoutGrid />
	{:else if tabType === "codeAgent"}
		<HatGlasses />
	{:else if tabType === "htmlPreview"}
		<MonitorSmartphone />
	{:else if tabType === "helpDocs"}
		<MessageCircleQuestionMark />
	{:else if tabType === "skillsHub"}
		<ShoppingBag />
	{:else if tabType === "openClawWebUi"}
		<span class="flex h-4 w-4 items-center justify-center [&>svg]:h-full [&>svg]:w-full">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html OpenClawRaw}
		</span>
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
		title={displayTitle}
		role="button"
	>
		<div bind:this={triggerRef} class="contents">
			<div class="mr-tab-icon size-tab-item-icon flex shrink-0 items-center justify-center">
				{@render tabIcon()}
			</div>

			{#if !isCompact}
				<span class="max-w-tab-title min-w-0 flex-1 truncate text-xs">{displayTitle}</span>
			{/if}
			<Button
				title={isCompact ? displayTitle : m.label_button_close()}
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
		</div>
	</ContextMenu.Trigger>
	<ContextMenu.Content class="min-w-48">
		<ContextMenu.Item onSelect={() => onTabNew()}>
			{m.label_button_new_tab()}
		</ContextMenu.Item>

		<ContextMenu.Separator />

		{#if isChatTab(tab.type)}
			<ContextMenu.Item onSelect={handleScreenshot} disabled={!isActive}>
				{m.screenshot_action()}
			</ContextMenu.Item>
			<ContextMenu.Separator />
		{/if}

		{#if tab.type === "aiApplications" || tab.type === "helpDocs" || tab.type === "skillsHub" || tab.type === "openClawWebUi"}
			<ContextMenu.Item onSelect={handleRefresh}>
				{m.label_button_reload()}
			</ContextMenu.Item>
			<ContextMenu.Item onSelect={handleOpenInBrowser}>
				{m.label_button_open_in_browser()}
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
							onSelect={() =>
								tabBarState.handleMoveTab(tab.id, "existing-window", windowId)}
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

		<ContextMenu.Separator />

		<ContextMenu.Item onSelect={() => onTabClose(tab.id)}>
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
