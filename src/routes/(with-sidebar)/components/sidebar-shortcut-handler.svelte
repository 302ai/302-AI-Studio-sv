<script lang="ts">
	import { useSidebar } from "$lib/components/ui/sidebar";
	import type { ShortcutActionEvent } from "@shared/types/shortcut";
	import { onMount } from "svelte";

	// Get sidebar context - must be inside Sidebar.Provider
	const sidebar = useSidebar();

	onMount(() => {
		const cleanup = window.electronAPI.shortcut.onShortcutAction?.((event: ShortcutActionEvent) => {
			if (event.action === "toggleSidebar") {
				sidebar.toggle();
			}
		});

		return cleanup;
	});
</script>
