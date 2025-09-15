<script lang="ts">
	import * as Sidebar from "$lib/components/ui/sidebar";
	import SettingsSidebar from "./settings-sidebar.svelte";

	let { children } = $props();
</script>

<Sidebar.Provider class="h-full min-h-fit" style="--sidebar-width: var(--setting-width);">
	<SettingsSidebar />
	<Sidebar.Inset class="flex-1">
		<div class="flex-1 overflow-auto">
			{@render children()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
