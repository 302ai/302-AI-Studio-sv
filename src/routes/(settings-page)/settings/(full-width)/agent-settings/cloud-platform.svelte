<script lang="ts">
	import { getManualRenewCharge } from "$lib/api/cloud-mode/base-apis";
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import StatusIndicator from "$lib/components/buss/local-agent-panel/status-indicator.svelte";
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import * as Pagination from "$lib/components/ui/pagination/index.js";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import { Switch } from "$lib/components/ui/switch";
	import * as Table from "$lib/components/ui/table/index.js";
	import { m } from "$lib/paraglide/messages";
	import { cloudModeState } from "$lib/stores/code-agent/cloud-mode-state.svelte";
	import { cn } from "$lib/utils";
	import { LoaderCircle, RefreshCw } from "@lucide/svelte";
	import { createLogger } from "@shared/logger";
	import type { GetManualRenewChargeResponse } from "@shared/storage/cloud-mode";
	import { format, parseISO } from "date-fns";
	import { toast } from "svelte-sonner";

	const logger = createLogger("ui");

	let { state: cloudState, openClaw, loading } = $derived(cloudModeState.init());

	let charges: GetManualRenewChargeResponse["charges"] = $state([]);
	let chargesPagination: GetManualRenewChargeResponse["pagination"] = $state({
		page: 1,
		pageSize: 5,
		total: 0,
		totalPages: 0,
	});
	let isLoadingCharges = $state(false);
	let hasInitialized = $state(false);

	async function fetchCharges(p1 = 1) {
		if (!cloudState.instanceName) return;
		isLoadingCharges = true;
		try {
			const res = await getManualRenewCharge(
				cloudState.instanceName,
				p1,
				chargesPagination.pageSize,
			);
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

	type StatusProps = { status: "green" | "red" | "gray"; text: string };

	function getHealthProps(s: "running" | "waiting_init" | "rebooting" | "rebooted"): StatusProps {
		switch (s) {
			case "running":
				return { status: "green", text: m.cloud_mode_healthy() };
			case "waiting_init":
				return { status: "gray", text: m.cloud_mode_initializing() };
			case "rebooting":
				return { status: "gray", text: m.cloud_mode_rebooting() };
			case "rebooted":
				return { status: "green", text: m.cloud_mode_rebooted() };
			default:
				return { status: "gray", text: m.cloud_mode_unknown() };
		}
	}

	function resolveOpenClawStatus(v: boolean | null): "green" | "red" | "gray" {
		return v == null ? "gray" : v ? "green" : "red";
	}

	function resolveOpenClawText(v: boolean | null): string {
		return v == null
			? m.cloud_mode_unknown()
			: v
				? m.cloud_mode_healthy()
				: m.cloud_mode_unhealthy();
	}

	function formatDate(iso?: string): string {
		if (!iso) return "--";
		return format(parseISO(iso), "yyyy-MM-dd");
	}

	async function handleAutoRenewChange(checked: boolean) {
		try {
			await cloudModeState.updateAutoRenew(checked);
		} catch (e) {
			toast.error(m.cloud_mode_auto_renew_error() + e);
		}
	}
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
		{#if loading.init}
			<Skeleton class="h-5 w-32" />
			<div class="rounded-lg border p-5 space-y-5">
				<div class="space-y-3">
					<div class="flex items-center gap-3">
						<Skeleton class="h-4 w-18" />
						<Skeleton class="h-4 w-20" />
					</div>
					<div class="flex items-center gap-3">
						<Skeleton class="h-4 w-18" />
						<Skeleton class="h-4 w-20" />
					</div>
					<div class="flex items-center gap-3">
						<Skeleton class="h-4 w-18" />
						<Skeleton class="h-4 w-20" />
					</div>
				</div>
			</div>
		{:else}
			<h2 class="text-sm font-medium">{m.local_platform_environment_monitoring()}</h2>
			<div class="rounded-lg border p-5 space-y-5">
				<div class="flex items-start justify-between gap-4">
					<div class="flex-1 space-y-3">
						<div class="flex items-center gap-3">
							<Label class="text-muted-foreground min-w-18 font-normal"
								>{m.agent_settings_instance_status()}</Label
							>
							<StatusIndicator
								status={getHealthProps(cloudState.status).status}
								text={getHealthProps(cloudState.status).text}
								warningTooltip={m.cloud_mode_unhealthy()}
							/>
						</div>
						<div class="flex items-center gap-3">
							<Label class="text-muted-foreground min-w-18 font-normal"
								>{m.cloud_mode_openclaw_status()}</Label
							>
							<StatusIndicator
								status={resolveOpenClawStatus(openClaw.status)}
								text={resolveOpenClawText(openClaw.status)}
								warningTooltip={m.cloud_mode_unhealthy()}
							/>
							<ButtonWithTooltip
								onclick={() => cloudModeState.restartMachine()}
								tooltip={m.cloud_mode_reboot_instance()}
								class="hover:!bg-icon-btn-hover size-8"
							>
								<RefreshCw
									class={cn("h-4 w-4", loading.restart && "animate-spin")}
								/>
							</ButtonWithTooltip>
						</div>
						<div class="flex items-center gap-3">
							<Label class="text-muted-foreground min-w-18 font-normal"
								>{m.cloud_mode_api_status()}</Label
							>
							<StatusIndicator
								status={resolveOpenClawStatus(openClaw.api_status)}
								text={resolveOpenClawText(openClaw.api_status)}
								warningTooltip={m.cloud_mode_unhealthy()}
							/>
						</div>
					</div>
				</div>
			</div>
		{/if}
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
			<h2 class="text-sm font-medium">{m.cloud_mode_subscription_info()}</h2>
			<div class="rounded-lg border p-5 space-y-5">
				<div class="flex justify-between items-center w-full">
					<h3 class="text-base font-semibold">{cloudState.instanceName}</h3>
					{#if cloudState.expired}
						<Button size="sm" onclick={() => void 0}>
							{#if loading.startVip}
								<LoaderCircle class="h-4 w-4 animate-spin" />
							{/if}
							{m.cloud_mode_activate_button()}
						</Button>
					{:else}
						<Button size="sm" onclick={() => {}}>
							{#if loading.startVip}
								<LoaderCircle class="h-4 w-4 animate-spin" />
							{:else}
								{m.cloud_mode_renew_button()}
							{/if}
						</Button>
					{/if}
				</div>
				<div class="flex justify-between items-end">
					<div class="space-y-1">
						{#if !cloudState.expired}
							<p class="text-sm text-muted-foreground">
								{m.cloud_mode_created_at()}：{formatDate(cloudState.createdAt)}
							</p>
							<p class="text-sm text-muted-foreground">
								{m.cloud_mode_expired_at()}：{formatDate(cloudState.expiredAt)}
							</p>
						{:else}
							<p class="text-sm text-muted-foreground">
								{m.cloud_mode_no_instance()}
							</p>
						{/if}
					</div>
					<div class="flex items-center">
						{#if loading.autoRenew}
							<LoaderCircle class="h-4 w-4 animate-spin" />
						{/if}
						<Switch
							disabled={loading.autoRenew}
							checked={cloudState.autoRenew}
							onCheckedChange={handleAutoRenewChange}
							class="data-[state=checked]:bg-primary cursor-pointer"
						/>
						<span class="text-sm text-muted-foreground ml-2"
							>{m.cloud_mode_auto_renew()}</span
						>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<div class="space-y-2">
		<div class="flex justify-between items-center">
			<h2 class="text-sm font-medium">{m.cloud_mode_subscription_history()}</h2>
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
									class="font-medium w-[40%] overflow-hidden text-ellipsis whitespace-nowrap"
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
