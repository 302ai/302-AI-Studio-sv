<script lang="ts">
	import { page } from "$app/state";
	import { DraggableList, type DndItem } from "$lib/components/buss/draggable-list";
	import { m } from "$lib/paraglide/messages";

	const { children } = $props();

	interface AgentNavItem extends DndItem {
		name: string;
		href: string;
	}

	let items = $state<AgentNavItem[]>([
		{
			id: "platform",
			name: "platform",
			href: "/settings/agent-settings/platform",
			label: m.agent_settings_tab_platform(),
		},
		{
			id: "other",
			name: "other",
			href: "/settings/agent-settings/other",
			label: m.agent_settings_tab_other(),
		},
	]);

	let activeItemId = $state<string>();

	$effect(() => {
		const currentPath = page.url.pathname;
		const activeItem = items.find((item) => currentPath.startsWith(item.href));
		if (activeItem) {
			activeItemId = activeItem.id;
		}
	});
</script>

<div class="w-full h-full flex">
	<div class="border-r w-56">
		<div class="flex h-full w-auto min-w-[var(--setting-width)] justify-end">
			<div class="flex w-full justify-end p-3">
				<div class="h-full w-full">
					<DraggableList bind:items bind:activeId={activeItemId} class="h-full" />
				</div>
			</div>
		</div>
	</div>
	<div class="grow py-4 px-6 h-full overflow-y-auto">
		{@render children()}
	</div>
</div>
