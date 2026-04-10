<script lang="ts">
	import { page } from "$app/state";
	import { m } from "$lib/paraglide/messages";
	import { cn } from "$lib/utils";

	const { children } = $props();

	interface AgentNavItem {
		id: string;
		name: string;
		href: string;
		label: string;
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
	<div class="border-r w-56 flex-shrink-0">
		<div class="flex h-full w-auto min-w-[var(--setting-width)] justify-end">
			<div class="flex w-full justify-end p-3">
				<div class="h-full w-full flex flex-col">
					{#each items as item (item.id)}
						<a
							draggable="false"
							href={item.href}
							class={cn(
								"flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium outline-hidden transition-colors my-1",
								item.id === activeItemId
									? "bg-tab-active text-tab-fg-active shadow-sm"
									: "bg-tab-inactive text-tab-fg-inactive hover:bg-tab-hover",
							)}
						>
							<span class="w-full truncate">{item.label}</span>
						</a>
					{/each}
				</div>
			</div>
		</div>
	</div>
	<div class="grow py-4 px-6 h-full overflow-y-auto">
		{@render children()}
	</div>
</div>
