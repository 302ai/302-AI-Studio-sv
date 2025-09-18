<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import favicon from "$lib/assets/favicon.svg";
	import { TabBar, type Tab } from "$lib/components/buss/tab-bar";
	import { Toaster } from "$lib/components/ui/sonner";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { Ghost, Home, Layout, MessageCircle, Settings } from "@lucide/svelte";
	import { ModeWatcher, setMode } from "mode-watcher";
	import { onMount } from "svelte";
	import "../app.css";

	const { children } = $props();

	let tabs = $state<Tab[]>([
		{
			id: "home",
			title: "Home",
			href: "/",
			closable: false,
			icon: homeIcon,
		},
		{
			id: "with-sidebar",
			title: "With Sidebar",
			href: "/dashboard",
			closable: true,
			icon: layoutIcon,
		},
		{
			id: "settings",
			title: "Settings",
			href: "/settings/general-settings",
			closable: true,
			icon: settingsIcon,
		},
	]);

	let activeTabId = $state("home");
	let isDetachedWindow = $state(false);

	$effect(() => {
		const currentPath = page.url.pathname;
		const existingTab = tabs.find((tab) => tab.href === currentPath);
		if (existingTab) {
			activeTabId = existingTab.id;
		}
	});

	function handleTabClick(tab: Tab) {
		activeTabId = tab.id;
		goto(tab.href);
	}

	function handleTabClose(tab: Tab) {
		const index = tabs.findIndex((t) => t.id === tab.id);
		if (index > -1 && tabs.length > 1) {
			tabs = tabs.filter((t) => t.id !== tab.id);
			if (activeTabId === tab.id) {
				const newIndex = Math.min(index, tabs.length - 1);
				const newTab = tabs[newIndex];
				activeTabId = newTab.id;
				goto(newTab.href);
			}
		}
	}

	function handleTabCloseAll() {
		const unclosableTabs = tabs.filter((tab) => tab.closable === false);
		if (unclosableTabs.length > 0) {
			tabs = unclosableTabs;
			activeTabId = unclosableTabs[0].id;
			goto(unclosableTabs[0].href);
		}
	}

	function handleNewTab() {
		// Don't create new tabs in detached windows
		if (isDetachedWindow) return;

		const chatId = `chat-${Date.now()}`;
		const newTab: Tab = {
			id: chatId,
			title: "New Chat",
			href: `/chat/${chatId}`,
			closable: true,
			icon: messageIcon,
		};
		tabs = [...tabs, newTab];
		activeTabId = newTab.id;
		goto(newTab.href);
	}

	onMount(async () => {
		// Get current theme from Electron and apply it
		if (window.electronAPI) {
			try {
				const currentTheme = await window.electronAPI.theme.getCurrentTheme();
				setMode(currentTheme);
			} catch (error) {
				console.warn("Failed to get current theme from Electron:", error);
			}
		}

		// Check if this window was created from a detached tab
		const urlParams = new URLSearchParams(window.location.search);
		const detachedTabParam = urlParams.get('detachedTab');

		console.log("URL params:", window.location.search);
		console.log("Detached tab param:", detachedTabParam);

		if (detachedTabParam) {
			try {
				const detachedTab = JSON.parse(decodeURIComponent(detachedTabParam));
				console.log("Parsed detached tab:", detachedTab);

				// Mark this as a detached window
				isDetachedWindow = true;

				// Restore the icon based on tab type/href
				let icon = homeIcon; // default icon
				if (detachedTab.href?.includes('/chat/')) {
					icon = messageIcon;
				} else if (detachedTab.href?.includes('/settings')) {
					icon = settingsIcon;
				} else if (detachedTab.href?.includes('/dashboard')) {
					icon = layoutIcon;
				}

				// Replace current tabs with only the detached tab (make it non-closable since it's the only tab)
				const detachedTabWithIcon = {
					...detachedTab,
					closable: false,
					icon: icon
				};
				tabs = [detachedTabWithIcon];
				activeTabId = detachedTab.id;

				console.log("Setting tabs to:", tabs);
				console.log("Setting active tab to:", activeTabId);

				// Set window title to match tab title
				if (detachedTab.title) {
					document.title = `${detachedTab.title} - 302-AI-Studio-SV`;
				}

				// Navigate to the tab's href
				console.log("Navigating to:", detachedTab.href);
				goto(detachedTab.href);
			} catch (error) {
				console.error("Failed to parse detached tab data:", error);
			}
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#snippet homeIcon()}
	<Home class="h-full w-full" />
{/snippet}

{#snippet layoutIcon()}
	<Layout class="h-full w-full" />
{/snippet}

{#snippet settingsIcon()}
	<Settings class="h-full w-full" />
{/snippet}

{#snippet messageIcon()}
	{#if chatState.isPrivateChatActive}
		<Ghost class="h-full w-full" />
	{:else}
		<MessageCircle class="h-full w-full" />
	{/if}
{/snippet}

<ModeWatcher />
<Toaster position="top-center" richColors />

<div class="flex h-screen flex-col">
	<TabBar
		bind:tabs
		bind:activeTabId
		onTabClick={handleTabClick}
		onTabClose={handleTabClose}
		onTabCloseAll={handleTabCloseAll}
		onNewTab={handleNewTab}
		showNewTabButton={!isDetachedWindow}
	/>

	<main class="h-[calc(100vh-env(titlebar-area-height,40px)-1px)] overflow-hidden">
		{@render children?.()}
	</main>
</div>
