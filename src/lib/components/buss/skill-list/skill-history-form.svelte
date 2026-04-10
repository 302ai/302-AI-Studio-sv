<script lang="ts">
	import * as Collapsible from "$lib/components/ui/collapsible/index.js";
	import { Input } from "$lib/components/ui/input";
	import { m } from "$lib/paraglide/messages";
	import { claudeCodeSandboxState } from "$lib/stores/code-agent/claude-code-sandbox-state.svelte";
	import { cloudModeSessionsState } from "$lib/stores/code-agent/cloud-mode-sessions-state.svelte";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import { localClaudeCodeSandboxState } from "$lib/stores/code-agent/local-claude-code-sandbox-state.svelte";
	import { ChevronDown, Search } from "@lucide/svelte";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";
	import { SvelteMap, SvelteSet } from "svelte/reactivity";

	interface HistorySessionItem {
		key: string;
		label: string;
		value: string;
		extra?: string;
	}

	interface HistorySessionGroup {
		groupKey: string;
		groupLabel: string;
		sandboxId: string;
		sandboxLabel: string;
		items: HistorySessionItem[];
	}

	interface HistorySessionData {
		groups: HistorySessionGroup[];
	}

	const groupedSessions = $derived.by<HistorySessionData>(() => {
		if (codeAgentState.type === "local") {
			const groupedByWorkspace = new SvelteMap<
				string,
				{
					groupLabel: string;
					latestUsedAt: number;
					items: HistorySessionItem[];
				}
			>();

			for (const session of localClaudeCodeSandboxState.sessions) {
				const workspacePath =
					session.workspace_path || m.local_platform_new_work_directory();
				const groupKey = `local:${workspacePath}`;
				const usedAt = new Date(session.used_at).getTime();

				if (!groupedByWorkspace.has(groupKey)) {
					groupedByWorkspace.set(groupKey, {
						groupLabel: workspacePath,
						latestUsedAt: isNaN(usedAt) ? 0 : usedAt,
						items: [],
					});
				}

				const group = groupedByWorkspace.get(groupKey)!;
				if (!isNaN(usedAt) && usedAt > group.latestUsedAt) {
					group.latestUsedAt = usedAt;
				}

				group.items.push({
					key: session.session_id,
					label: session.note || session.session_id,
					value: session.session_id,
					extra: session.used_at,
				});
			}

			const groups = Array.from(groupedByWorkspace.entries())
				.map(([groupKey, group]) => ({
					groupKey,
					groupLabel: group.groupLabel,
					sandboxId: "local",
					sandboxLabel: group.groupLabel,
					latestUsedAt: group.latestUsedAt,
					items: group.items.sort(
						(a, b) =>
							new Date(b.extra ?? 0).getTime() - new Date(a.extra ?? 0).getTime(),
					),
				}))
				.sort((a, b) => b.latestUsedAt - a.latestUsedAt)
				.map(({ latestUsedAt: _latestUsedAt, ...group }) => group);

			return { groups };
		}

		if (codeAgentState.type === "cloud") {
			const groupedByWorkspace = new SvelteMap<
				string,
				{
					groupLabel: string;
					latestUsedAt: number;
					items: HistorySessionItem[];
				}
			>();

			for (const session of cloudModeSessionsState.sessions) {
				const workspacePath =
					session.workspace_path || m.local_platform_new_work_directory();
				const groupKey = `local:${workspacePath}`;
				const usedAt = new Date(session.used_at).getTime();

				if (!groupedByWorkspace.has(groupKey)) {
					groupedByWorkspace.set(groupKey, {
						groupLabel: workspacePath,
						latestUsedAt: isNaN(usedAt) ? 0 : usedAt,
						items: [],
					});
				}

				const group = groupedByWorkspace.get(groupKey)!;
				if (!isNaN(usedAt) && usedAt > group.latestUsedAt) {
					group.latestUsedAt = usedAt;
				}

				group.items.push({
					key: session.session_id,
					label: session.note || session.session_id,
					value: session.session_id,
					extra: session.used_at,
				});
			}

			const groups = Array.from(groupedByWorkspace.entries())
				.map(([groupKey, group]) => ({
					groupKey,
					groupLabel: group.groupLabel,
					sandboxId: "local",
					sandboxLabel: group.groupLabel,
					latestUsedAt: group.latestUsedAt,
					items: group.items.sort(
						(a, b) =>
							new Date(b.extra ?? 0).getTime() - new Date(a.extra ?? 0).getTime(),
					),
				}))
				.sort((a, b) => b.latestUsedAt - a.latestUsedAt)
				.map(({ latestUsedAt: _latestUsedAt, ...group }) => group);

			return { groups };
		}

		return {
			groups: claudeCodeSandboxState.groupedSessions.groups.map((group) => ({
				groupKey: group.groupKey,
				groupLabel: group.groupLabel,
				sandboxId: group.groupKey,
				sandboxLabel: group.groupLabel,
				items: group.items,
			})),
		};
	});

	let selectedId = $state<string | null>(null);
	let expandedSandboxes = $state<Set<string>>(new Set());
	let searchQuery = $state("");
	let groupSignature = $state("");

	onMount(async () => {
		await codeAgentState.refreshSessions();
	});

	// Filter groups based on search query
	const filteredGroups = $derived.by(() => {
		if (!searchQuery.trim()) {
			return groupedSessions.groups;
		}
		const query = searchQuery.toLowerCase();
		return groupedSessions.groups
			.map((group) => ({
				...group,
				items: group.items.filter(
					(session) =>
						session.label.toLowerCase().includes(query) ||
						group.groupLabel.toLowerCase().includes(query),
				),
			}))
			.filter((group) => group.items.length > 0);
	});

	// Initialize expanded state - default to all expanded
	$effect(() => {
		const nextSignature = groupedSessions.groups.map((group) => group.groupKey).join("|");
		if (nextSignature !== groupSignature) {
			groupSignature = nextSignature;
			expandedSandboxes = new SvelteSet(groupedSessions.groups.map((g) => g.groupKey));
		}
	});

	$effect(() => {
		if (!selectedId) return;
		const exists = groupedSessions.groups.some((group) =>
			group.items.some((session) => session.value === selectedId),
		);
		if (!exists) {
			selectedId = null;
		}
	});

	function toggleSandbox(sandboxId: string) {
		const newSet = new SvelteSet(expandedSandboxes);
		if (newSet.has(sandboxId)) {
			newSet.delete(sandboxId);
		} else {
			newSet.add(sandboxId);
		}
		expandedSandboxes = newSet;
	}

	export function validate(): boolean {
		if (!selectedId) {
			toast.warning(m.skills_history_select_required());
			return false;
		}
		return true;
	}

	export function getSelectedConversation() {
		for (const group of groupedSessions.groups) {
			const session = group.items.find((s) => s.value === selectedId);
			if (session) {
				return {
					sessionId: session.value,
					title: session.label,
					sandboxId: group.sandboxId,
					sandboxLabel: group.sandboxLabel,
					extra: session.extra,
				};
			}
		}
		return null;
	}
</script>

<div class="flex flex-col h-full px-6 py-6">
	<!-- Search box -->
	<div class="relative w-full mb-4 shrink-0">
		<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
		<Input
			type="text"
			placeholder={m.placeholder_input_search()}
			bind:value={searchQuery}
			class="pl-9 h-10 rounded-lg dark:border-[#3d3d3d]"
		/>
	</div>

	<!-- Grouped conversation list -->
	<div class="flex w-full flex-col gap-1 flex-1 min-h-0 overflow-y-auto">
		{#if filteredGroups.length === 0}
			<div class="text-muted-foreground text-center text-sm py-8">
				{searchQuery ? m.no_search_results() : m.no_sessions()}
			</div>
		{:else}
			{#each filteredGroups as group (group.groupKey)}
				{@const isExpanded = expandedSandboxes.has(group.groupKey)}
				<Collapsible.Root
					open={isExpanded}
					onOpenChange={() => toggleSandbox(group.groupKey)}
				>
					<!-- Sandbox header (collapsible trigger) -->
					<Collapsible.Trigger
						class="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
					>
						<ChevronDown
							class="text-muted-foreground h-3.5 w-3.5 transition-transform duration-200 {isExpanded
								? ''
								: '-rotate-90'}"
						/>
						<span class="text-foreground text-sm font-medium">{group.groupLabel}</span>
						<span class="text-muted-foreground text-xs">({group.items.length})</span>
					</Collapsible.Trigger>

					<!-- Sessions list -->
					<Collapsible.Content class="ml-5 mt-0.5 flex flex-col gap-0.5">
						{#each group.items as session (session.value)}
							{@const isSelected = selectedId === session.value}
							<button
								type="button"
								class="w-full rounded-md px-3 py-2 text-left transition-all {isSelected
									? 'bg-primary/10 text-primary'
									: 'hover:bg-muted/50'}"
								onclick={() => {
									selectedId = session.value;
								}}
							>
								<div class="flex items-center justify-between gap-3">
									<span class="text-sm truncate {isSelected ? 'font-medium' : ''}"
										>{session.label}</span
									>
									{#if session.extra}
										<span
											class="text-muted-foreground text-xs whitespace-nowrap"
										>
											{new Date(session.extra).toLocaleString(undefined, {
												month: "2-digit",
												day: "2-digit",
												hour: "2-digit",
												minute: "2-digit",
											})}
										</span>
									{/if}
								</div>
							</button>
						{/each}
					</Collapsible.Content>
				</Collapsible.Root>
			{/each}
		{/if}
	</div>
</div>
