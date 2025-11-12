<script lang="ts">
	import * as Sidebar from "$lib/components/ui/sidebar";
	import { fly } from "svelte/transition";
	import AppSidebar from "./components/app-sidebar.svelte";
	import SidebarShortcutHandler from "./components/sidebar-shortcut-handler.svelte";

	const { children } = $props();
</script>

<Sidebar.Provider class="h-full min-h-fit">
	<!-- Handle sidebar shortcuts - must be inside Provider to access context -->
	<SidebarShortcutHandler />

	<AppSidebar />

	<Sidebar.Inset class="flex flex-col flex-1">
		<div class="flex-1 overflow-auto" transition:fly={{ y: 20, duration: 800 }}>
			{@render children?.()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
