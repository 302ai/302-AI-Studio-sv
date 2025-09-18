<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { resolve } from "$app/paths";
	import favicon from "$lib/assets/favicon.svg";
	import { TabBar, type Tab } from "$lib/components/buss/tab-bar";
	import { Toaster } from "$lib/components/ui/sonner";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { Ghost, Home, Layout, MessageCircle, Settings } from "@lucide/svelte";
	import { ModeWatcher, setMode } from "mode-watcher";
	import { onMount } from "svelte";
	import { polyfillLocalStorage } from "$lib/utils/storage-polyfill";
	import { providerState } from "$lib/stores/provider-state.svelte";
	import "../app.css";

	const { children } = $props();
	const { app } = window.electronAPI;
	const { onThemeChange } = window.electronIPC;

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

	$effect(() => {
		const currentPath = page.url.pathname;
		const existingTab = tabs.find((tab) => tab.href === currentPath);
		if (existingTab) {
			activeTabId = existingTab.id;
		}
	});

	function handleTabClick(tab: Tab) {
		activeTabId = tab.id;
		goto(resolve(tab.href));
	}

	function handleTabClose(tab: Tab) {
		const index = tabs.findIndex((t) => t.id === tab.id);
		if (index > -1 && tabs.length > 1) {
			tabs = tabs.filter((t) => t.id !== tab.id);
			if (activeTabId === tab.id) {
				const newIndex = Math.min(index, tabs.length - 1);
				const newTab = tabs[newIndex];
				activeTabId = newTab.id;
				goto(resolve(newTab.href));
			}
		}
	}

	function handleTabCloseAll() {
		const unclosableTabs = tabs.filter((tab) => tab.closable === false);
		if (unclosableTabs.length > 0) {
			tabs = unclosableTabs;
			activeTabId = unclosableTabs[0].id;
			goto(resolve(unclosableTabs[0].href));
		}
	}

	function handleNewTab() {
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
		goto(resolve(newTab.href));
	}

	onMount(async () => {
		await polyfillLocalStorage();
		await providerState.initialize();

		// Get current theme from Electron and apply it
		if (app) {
			try {
				const currentTheme = await app.getCurrentTheme();
				setMode(currentTheme);
			} catch (error) {
				console.warn("Failed to get current theme from Electron:", error);
			}
		}

		// Listen for theme changes from Electron
		if (onThemeChange) {
			onThemeChange((theme) => {
				console.log("Theme changed from Electron:", theme);
				setMode(theme);
			});
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
	/>

	<main class="h-[calc(100vh-env(titlebar-area-height,40px)-1px)] overflow-hidden">
		{@render children?.()}
	</main>
</div>
