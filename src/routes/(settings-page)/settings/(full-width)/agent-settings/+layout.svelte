<script lang="ts">
	import { page } from "$app/state";
	import { DraggableList, type DndItem } from "$lib/components/buss/draggable-list";
	import { m } from "$lib/paraglide/messages";
	import { cn } from "$lib/utils";

	const { children } = $props();

	interface AgentNavItem extends DndItem {
		name: string;
		path: string;
		labelKey: string;
	}

	let items = $state<AgentNavItem[]>([
		{
			id: "platform",
			name: "platform",
			path: "/settings/agent-settings/platform",
			labelKey: m.agent_settings_tab_platform(),
		},
		{
			id: "other",
			name: "other",
			path: "/settings/agent-settings/other",
			labelKey: m.agent_settings_tab_other(),
		},
	]);

	let activeItemId = $state<string>();

	$effect(() => {
		const currentPath = page.url.pathname;
		const activeItem = items.find((item) => currentPath.startsWith(item.path));
		if (activeItem) {
			activeItemId = activeItem.id;
		}
	});
</script>

<div class="w-full h-full flex">
	<div class="border-r">
		<div class="flex h-full w-auto min-w-[var(--setting-width)] justify-end">
			<div class="flex w-full justify-end p-3">
				<div class="h-full w-full">
					<DraggableList bind:items bind:activeId={activeItemId} class="h-full">
						{#snippet children(item: AgentNavItem, isActiveItem: boolean)}
							<a
								href={item.path}
								draggable="false"
								class={cn(
									"px-settings-item-x py-settings-item-y flex w-full items-center rounded-lg text-sm font-medium whitespace-nowrap outline-hidden transition-colors",
									isActiveItem
										? "text-accent-fg bg-accent"
										: "text-foreground bg-tab-inactive hover:bg-tab-hover",
								)}
								role="tab"
								aria-selected={isActiveItem}
								tabindex={isActiveItem ? 0 : -1}
							>
								<span class="w-full text-right">{item.labelKey}</span>
							</a>
						{/snippet}
					</DraggableList>
				</div>
			</div>
		</div>
	</div>
	<div class="grow py-4 px-6 h-full overflow-y-auto">
		{@render children()}
	</div>
</div>
