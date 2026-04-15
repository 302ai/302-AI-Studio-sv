<script lang="ts">
	import { getManualRenewCharge } from "$lib/api/cloud-mode/base-apis";
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import EnvironmentMonitor from "$lib/components/buss/cloud-mode-panel/environment-monitor.svelte";
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import { Button } from "$lib/components/ui/button";
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import * as Empty from "$lib/components/ui/empty/index.js";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import * as Pagination from "$lib/components/ui/pagination/index.js";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import { Switch } from "$lib/components/ui/switch";
	import * as Table from "$lib/components/ui/table/index.js";
	import { m } from "$lib/paraglide/messages";
	import {
		cloudModeSessionsState,
		persistedCloudModeSessionsState,
	} from "$lib/stores/code-agent/cloud-mode-sessions-state.svelte";
	import { cloudModeState } from "$lib/stores/code-agent/cloud-mode-state.svelte";
	import { cn } from "$lib/utils";
	import { LoaderCircle, RefreshCw, RotateCw, Search } from "@lucide/svelte";
	import { createLogger } from "@shared/logger";
	import type { GetManualRenewChargeResponse } from "@shared/storage/cloud-mode";
	import type { LocalSessionInfo } from "@shared/storage/code-agent";
	import { format, parseISO } from "date-fns";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";
	import SandboxDeleteConfirmDialog from "./sandbox-delete-confirm-dialog.svelte";

	const logger = createLogger("ui");

	let { state: cloudState, loading } = $derived(cloudModeState.init());

	let charges: GetManualRenewChargeResponse["charges"] = $state([]);
	let chargesPagination: GetManualRenewChargeResponse["pagination"] = $state({
		page: 1,
		pageSize: 5,
		total: 0,
		totalPages: 0,
	});
	let isLoadingCharges = $state(false);
	let hasInitialized = $state(false);
	let showConfirmDialog = $state(false);
	let showRestartMachineDialog = $state(false);
	let showRestartOpenClawDialog = $state(false);

	// Session list state
	let searchQuery = $state("");
	let isSessionLoading = $state(false);
	let targetSession = $state<LocalSessionInfo | null>(null);
	let isDeleteDialogOpen = $state(false);

	// Filter sessions based on search query
	const filteredSessions = $derived.by(() => {
		const sessions = persistedCloudModeSessionsState.current;
		if (!searchQuery.trim()) return sessions;

		const query = searchQuery.toLowerCase();
		return sessions.filter(
			(session) =>
				session.session_id.toLowerCase().includes(query) ||
				(session.note?.toLowerCase().includes(query) ?? false) ||
				(session.workspace_path?.toLowerCase().includes(query) ?? false),
		);
	});

	let isRenewal = $derived(!!cloudState.instanceName);

	async function fetchCharges(p1 = 1) {
		if (!cloudState.instanceName) return;
		isLoadingCharges = true;
		try {
			const res = await getManualRenewCharge(p1, chargesPagination.pageSize);
			charges = res.charges;
			chargesPagination = res.pagination;
		} catch (e) {
			logger.error("Failed to fetch charges:", e);
		} finally {
			isLoadingCharges = false;
			hasInitialized = true;
		}
	}

	$effect(() => {
		if (cloudState.instanceName && !hasInitialized && !isLoadingCharges) {
			fetchCharges(1);
		}
	});

	function formatDate(iso?: string): string {
		if (!iso) return "--";
		return format(parseISO(iso), "yyyy-MM-dd");
	}

	async function handleAutoRenewChange(checked: boolean) {
		if (!cloudState.instanceName || cloudState.expired) return;
		try {
			await cloudModeState.updateAutoRenew(checked);
		} catch (e) {
			toast.error(m.cloud_mode_auto_renew_error() + e);
		}
	}

	async function handleConfirmCreateOrRenew() {
		try {
			await cloudModeState.createInstance();
			showConfirmDialog = false;
		} catch (e) {
			toast.error(
				(isRenewal ? m.cloud_mode_renew_failed() : m.cloud_mode_create_failed()) + e,
			);
		}
	}

	async function handleSessionRefresh() {
		isSessionLoading = true;
		try {
			await cloudModeSessionsState.refreshSessions();
		} finally {
			isSessionLoading = false;
		}
	}

	function handleDeleteClick(session: LocalSessionInfo) {
		targetSession = session;
		isDeleteDialogOpen = true;
	}

	async function handleRestartOpenClaw() {
		try {
			await cloudModeState.restartOpenClaw();
			showRestartOpenClawDialog = false;
		} catch (e) {
			toast.error(m.cloud_mode_openclaw_restart_failed() + e);
		}
	}

	async function handleRestartMachine() {
		try {
			await cloudModeState.restartMachine();
			showRestartMachineDialog = false;
		} catch (e) {
			toast.error(m.cloud_mode_instance_restart_failed() + e);
		}
	}

	onMount(() => {
		handleSessionRefresh();
	});
</script>

{#snippet tableHeader()}
	<Table.Header>
		<Table.Row>
			<Table.Head class="w-[40%]">{m.cloud_mode_charge_instance_name()}</Table.Head>
			<Table.Head class="w-[35%]">{m.cloud_mode_charge_activation_time()}</Table.Head>
			<Table.Head class="w-[25%] text-right">{m.cloud_mode_charge_amount()}</Table.Head>
		</Table.Row>
	</Table.Header>
{/snippet}

{#snippet skeletonRows(count = 5)}
	{#each Array(count) as _, i (i)}
		<Table.Row class="h-[49px]">
			<Table.Cell class="w-[40%]"><Skeleton class="h-4 w-32" /></Table.Cell>
			<Table.Cell class="w-[35%]"><Skeleton class="h-4 w-24" /></Table.Cell>
			<Table.Cell class="w-[25%] text-right"><Skeleton class="h-4 w-16 ml-auto" /></Table.Cell
			>
		</Table.Row>
	{/each}
{/snippet}

<div class="flex flex-col space-y-6">
	<div class="space-y-2">
		<EnvironmentMonitor />
	</div>

	<div class="space-y-2">
		{#if loading.init}
			<Skeleton class="h-5 w-24" />
			<div class="rounded-lg border p-5 space-y-5">
				<div class="flex justify-between items-center w-full">
					<Skeleton class="h-5 w-40" />
					<Skeleton class="h-4 w-28" />
				</div>
				<div class="space-y-1">
					<Skeleton class="h-4 w-48" />
					<Skeleton class="h-4 w-48" />
					<Skeleton class="h-4 w-48" />
				</div>
			</div>
		{:else}
			<Label class="text-label-fg font-normal">{m.cloud_mode_subscription_info()}</Label>
			<div class="rounded-lg border p-5 space-y-5">
				<div class="flex justify-between items-end w-full">
					<div class="space-y-1">
						<p class="text-sm text-muted-foreground">
							{m.cloud_mode_instance_name()}：{#if cloudState.instanceName}
								<span
									class={cn(
										"font-medium",
										cloudState.expired ? "text-destructive" : "text-primary",
									)}
								>
									{cloudState.expired
										? m.cloud_mode_expired()
										: cloudState.instanceName}
								</span>
							{:else}
								{m.cloud_mode_not_activated()}
							{/if}
						</p>
						<p class="text-sm text-muted-foreground">
							{m.cloud_mode_created_at()}：{cloudState.createdAt
								? formatDate(cloudState.createdAt)
								: m.cloud_mode_unknown()}
						</p>
						<p class="text-sm text-muted-foreground">
							{m.cloud_mode_expired_at()}：{cloudState.expiredAt
								? formatDate(cloudState.expiredAt)
								: m.cloud_mode_unknown()}
						</p>
					</div>
					<div class="flex flex-col items-end gap-3">
						<Button size="sm" onclick={() => (showConfirmDialog = true)}>
							{#if loading.createOrRenew}
								<LoaderCircle class="h-4 w-4 animate-spin" />
							{/if}
							{isRenewal
								? m.cloud_mode_renew_button()
								: m.cloud_mode_activate_button()}
						</Button>
						<div class="flex items-center gap-2">
							<Switch
								disabled={loading.autoRenew}
								checked={cloudState.autoRenew}
								onCheckedChange={handleAutoRenewChange}
								class="data-[state=checked]:bg-primary cursor-pointer"
							/>
							<span class="text-sm text-muted-foreground flex items-center gap-2">
								{m.cloud_mode_auto_renew()}
								{#if loading.autoRenew}
									<LoaderCircle class="h-4 w-4 animate-spin" />
								{/if}
							</span>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Section 3: Cloud Session List -->
	<div class="space-y-2">
		<div class="flex items-center justify-between">
			<div class="flex items-center">
				<Label class="text-label-fg font-normal">{m.title_cloud_session_list()}</Label>
				<div class="flex gap-1">
					<ButtonWithTooltip
						class="hover:!bg-chat-action-hover"
						tooltip={m.label_button_reload()}
						onclick={handleSessionRefresh}
						disabled={isSessionLoading}
					>
						<RotateCw class={cn("h-4 w-4", isSessionLoading ? "animate-spin" : "")} />
					</ButtonWithTooltip>
				</div>
			</div>
			<!-- Search -->
			<div class="relative">
				<Search
					class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					placeholder={m.placeholder_search_session()}
					class="pl-9 bg-muted/50 border-transparent focus-visible:ring-0 focus-visible:bg-background"
					bind:value={searchQuery}
				/>
			</div>
		</div>

		<!-- Session List -->
		<div
			class={cn(
				"p-2",
				(filteredSessions.length > 0 || isSessionLoading) &&
					"rounded-lg border bg-muted/20",
			)}
		>
			{#if isSessionLoading}
				<div class="flex flex-col gap-2">
					{#each Array(5) as _, i (i)}
						<div class="rounded-lg bg-muted/50 p-4 animate-pulse">
							<Skeleton class="h-4 w-32 mb-2" />
							<Skeleton class="h-3 w-48" />
						</div>
					{/each}
				</div>
			{:else if filteredSessions.length === 0}
				<Empty.Root>
					<Empty.Content class="h-[200px] flex flex-col items-center justify-start pt-8">
						<Empty.Description>
							{searchQuery ? m.no_search_results() : m.no_sessions()}
						</Empty.Description>
					</Empty.Content>
				</Empty.Root>
			{:else}
				<div class="max-h-[360px] overflow-y-auto pr-1">
					<div class="flex flex-col gap-2">
						{#each filteredSessions as session (session.session_id)}
							<ContextMenu.Root>
								<ContextMenu.Trigger>
									<div
										class="flex cursor-pointer items-center justify-between rounded-lg bg-muted/50 p-4 transition-colors hover:bg-muted/70"
									>
										<div class="flex flex-col gap-1">
											<span class="font-medium text-sm">
												{session.note || session.session_id}
											</span>
											<span class="text-xs text-muted-foreground"
												>{session.session_id}</span
											>
										</div>
										{#if session.workspace_path}
											<div class="flex flex-col items-end gap-1">
												<span class="text-xs text-muted-foreground">
													{session.workspace_path}
												</span>
											</div>
										{/if}
									</div>
								</ContextMenu.Trigger>
								<ContextMenu.Content>
									<ContextMenu.Item
										class="text-destructive focus:text-destructive"
										onclick={() => handleDeleteClick(session)}
									>
										{m.text_button_delete()}
									</ContextMenu.Item>
								</ContextMenu.Content>
							</ContextMenu.Root>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<div class="space-y-2">
		<div class="flex justify-between items-center">
			<Label class="text-label-fg font-normal">{m.cloud_mode_subscription_history()}</Label>
			<ButtonWithTooltip
				onclick={() => fetchCharges(chargesPagination.page)}
				tooltip={m.refresh()}
				class="hover:!bg-icon-btn-hover size-8"
				disabled={isLoadingCharges}
			>
				<RefreshCw class={cn("h-4 w-4", isLoadingCharges && "animate-spin")} />
			</ButtonWithTooltip>
		</div>
		<div class="rounded-lg border overflow-hidden min-h-[300px]">
			<Table.Root class="table-fixed w-full">
				{@render tableHeader()}
				<Table.Body>
					{#if isLoadingCharges}
						{@render skeletonRows(chargesPagination.pageSize || 5)}
					{:else if charges.length > 0}
						{#each charges as charge (charge.chargedAt + charge.instanceName)}
							<Table.Row class="h-[49px]">
								<Table.Cell
									class="font-medium text-primary w-[40%] overflow-hidden text-ellipsis whitespace-nowrap"
									>{charge.instanceName}</Table.Cell
								>
								<Table.Cell class="w-[35%]"
									>{formatDate(charge.chargedAt)}</Table.Cell
								>
								<Table.Cell class="text-right w-[25%]">
									${(charge.amountCent / 100).toFixed(2)}
								</Table.Cell>
							</Table.Row>
						{/each}
					{:else}
						<Table.Row>
							<Table.Cell colspan={3} class="text-center py-6 text-muted-foreground">
								{m.cloud_mode_charge_empty()}
							</Table.Cell>
						</Table.Row>
					{/if}
				</Table.Body>
			</Table.Root>

			{#if chargesPagination.totalPages > 1}
				<div class="p-4 border-t flex justify-center">
					<Pagination.Root
						count={chargesPagination.total}
						perPage={chargesPagination.pageSize}
						bind:page={chargesPagination.page}
						onPageChange={(p1) => fetchCharges(p1)}
					>
						{#snippet children({ pages })}
							<Pagination.Content>
								<Pagination.Item>
									<Pagination.PrevButton
										class="rounded-[10px] hover:!bg-chat-action-hover"
									/>
								</Pagination.Item>
								{#each pages as page (page.key)}
									{#if page.type === "ellipsis"}
										<Pagination.Item>
											<Pagination.Ellipsis />
										</Pagination.Item>
									{:else}
										<Pagination.Item>
											<Pagination.Link
												{page}
												isActive={chargesPagination.page === page.value}
												class={cn(
													"rounded-[10px] hover:!bg-chat-action-hover border-none",
													chargesPagination.page === page.value &&
														"!bg-chat-action-active hover:!bg-chat-action-active !text-chat-action-active-fg",
												)}
											>
												{page.value}
											</Pagination.Link>
										</Pagination.Item>
									{/if}
								{/each}
								<Pagination.Item>
									<Pagination.NextButton
										class="rounded-[10px] hover:!bg-chat-action-hover"
									/>
								</Pagination.Item>
							</Pagination.Content>
						{/snippet}
					</Pagination.Root>
				</div>
			{/if}
		</div>
	</div>
</div>

<AlertDialog.Root bind:open={showConfirmDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>
				{isRenewal
					? m.cloud_mode_renew_confirm_title()
					: m.cloud_mode_activate_confirm_title()}
			</AlertDialog.Title>
			<AlertDialog.Description>
				{isRenewal
					? m.cloud_mode_renew_confirm_desc()
					: m.cloud_mode_activate_confirm_desc()}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{m.common_cancel()}</AlertDialog.Cancel>
			<AlertDialog.Action
				disabled={loading.createOrRenew}
				onclick={handleConfirmCreateOrRenew}
			>
				{#if loading.createOrRenew}
					<LoaderCircle class="h-4 w-4 animate-spin" />
				{/if}
				{m.cloud_mode_confirm()}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root bind:open={showRestartMachineDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{m.cloud_mode_restart_machine_confirm_title()}</AlertDialog.Title>
			<AlertDialog.Description>
				{m.cloud_mode_restart_machine_confirm_desc()}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{m.common_cancel()}</AlertDialog.Cancel>
			<AlertDialog.Action disabled={loading.restart} onclick={handleRestartMachine}>
				{#if loading.restart}
					<LoaderCircle class="h-4 w-4 animate-spin" />
				{/if}
				{m.cloud_mode_confirm()}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root bind:open={showRestartOpenClawDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{m.cloud_mode_restart_openclaw_confirm_title()}</AlertDialog.Title>
			<AlertDialog.Description>
				{m.cloud_mode_restart_openclaw_confirm_desc()}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{m.common_cancel()}</AlertDialog.Cancel>
			<AlertDialog.Action disabled={loading.restartOpenClaw} onclick={handleRestartOpenClaw}>
				{#if loading.restartOpenClaw}
					<LoaderCircle class="h-4 w-4 animate-spin" />
				{/if}
				{m.cloud_mode_confirm()}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<SandboxDeleteConfirmDialog bind:open={isDeleteDialogOpen} mode="cloud" session={targetSession} />
