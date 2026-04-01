<script lang="ts">
	import Sidebar from "$lib/settings/sidebar.svelte";
	import { m } from "$lib/paraglide/messages";

	const { children } = $props();

	const items = [
		{
			name: "platform",
			path: "/settings/agent-settings/platform",
			labelKey: m.agent_settings_tab_platform(),
		},
		{
			name: "other",
			path: "/settings/agent-settings/other",
			labelKey: m.agent_settings_tab_other(),
		},
	];
</script>

<div class="w-full h-full flex">
	<div class="border-l border-accent">
		<Sidebar {items} />
	</div>
	<div class="grow py-4 px-6 h-full overflow-y-auto">
		{@render children()}
	</div>
</div>
