<script lang="ts">
	import {
		deleteDeployedWebsite,
		getWebserveList,
		validate302Provider,
		type WebserveListResponse,
	} from "$lib/api/webserve-deploy";
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import SettingInfoItem from "$lib/components/buss/settings/setting-info-item.svelte";
	import { Button } from "$lib/components/ui/button";
	import * as Dialog from "$lib/components/ui/dialog";
	import * as Empty from "$lib/components/ui/empty";
	import { m } from "$lib/paraglide/messages";
	import { persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { cn } from "$lib/utils";
	import {
		ChevronLeft,
		ChevronRight,
		ExternalLink,
		List,
		Loader2,
		RotateCw,
		Trash2,
	} from "@lucide/svelte";
	import { untrack } from "svelte";
	import { toast } from "svelte-sonner";
	import { createLogger } from "@shared/logger";

	const logger = createLogger("ui");

	let isOpen = $state(false);
	let isLoading = $state(false);
	let websiteList = $state<NonNullable<WebserveListResponse["data"]>>([]);
	let pagination = $state<NonNullable<WebserveListResponse["pagination"]>>({
		current_page: 1,
		page_size: 10,
		total_items: 0,
		total_pages: 0,
	});
	let deleteConfirmDialogOpen = $state(false);
	let deleteConfirmId = $state<number | null>(null);
	let isDeleting = $state(false);

	async function fetchWebsites(page = 1) {
		if (isLoading) return;
		isLoading = true;
		try {
			const validation = validate302Provider(persistedProviderState.current);
			if (!validation.valid) {
				logger.error("Provider validation failed:", validation.error);
				return;
			}
			const provider = validation.provider;

			const response = await getWebserveList(provider, { page, limit: pagination.page_size });
			if (response.success && response.data) {
				websiteList = response.data;
				if (response.pagination) {
					pagination = response.pagination;
				}
			} else {
				logger.error("Failed to fetch websites:", response.error);
			}
		} finally {
			isLoading = false;
		}
	}

	function handleRefresh() {
		fetchWebsites(pagination.current_page);
	}

	function handlePageChange(newPage: number) {
		if (newPage < 1 || (pagination.total_pages > 0 && newPage > pagination.total_pages)) return;
		fetchWebsites(newPage);
	}

	function openDeleteConfirm(id: number) {
		deleteConfirmId = id;
		deleteConfirmDialogOpen = true;
	}

	async function confirmDelete() {
		if (!deleteConfirmId) return;

		const id = deleteConfirmId;
		isDeleting = true;

		try {
			const validation = validate302Provider(persistedProviderState.current);
			if (!validation.valid) {
				toast.error(m.toast_no_provider_configured());
				return;
			}
			const provider = validation.provider;

			const response = await deleteDeployedWebsite(provider, id);
			if (response.success) {
				toast.success(m.toast_delete_success ? m.toast_delete_success() : "Deleted successfully");
				// Refresh current page
				fetchWebsites(pagination.current_page);
				// Close dialog and reset state only on success
				deleteConfirmDialogOpen = false;
				deleteConfirmId = null;
			} else {
				toast.error(
					(m.toast_delete_failed ? m.toast_delete_failed() : "Failed to delete") +
						(response.error ? `: ${response.error}` : ""),
				);
			}
		} catch (error) {
			logger.error("Failed to delete website:", error);
			toast.error(m.toast_unknown_error());
		} finally {
			isDeleting = false;
		}
	}

	// Fetch when dialog opens
	$effect(() => {
		if (isOpen) {
			untrack(() => {
				fetchWebsites();
			});
		}
	});
</script>

{#snippet viewWebsitesButton()}
	<Button variant="outline" size="sm" class="gap-2" onclick={() => (isOpen = true)}>
		<List class="h-4 w-4" />
		{m.text_button_view_deployed_websites
			? m.text_button_view_deployed_websites()
			: "View Deployed Websites"}
	</Button>
{/snippet}

<SettingInfoItem
	label={m.title_deployed_websites ? m.title_deployed_websites() : "Deployed Websites"}
	action={viewWebsitesButton}
/>

<Dialog.Root bind:open={isOpen}>
	<Dialog.Content class="min-w-2xl">
		<Dialog.Header>
			<Dialog.Title class="flex items-center relative">
				<span>{m.title_deployed_websites ? m.title_deployed_websites() : "Deployed Websites"}</span>
				<ButtonWithTooltip
					class="hover:!bg-chat-action-hover absolute left-[98px]"
					tooltip={m.label_button_reload()}
					onclick={handleRefresh}
					disabled={isLoading}
				>
					<RotateCw class={cn("h-4 w-4", isLoading ? "animate-spin" : "")} />
				</ButtonWithTooltip>
			</Dialog.Title>
		</Dialog.Header>

		<div class="min-h-[300px] max-h-[500px] overflow-y-auto py-4">
			{#if isLoading}
				<div class="flex h-full min-h-[300px] w-full items-center justify-center">
					<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			{:else if websiteList.length === 0}
				<Empty.Root>
					<Empty.Content class="h-[200px] flex flex-col items-center justify-center">
						<Empty.Description>
							{m.no_deployed_websites ? m.no_deployed_websites() : "No deployed websites found"}
						</Empty.Description>
					</Empty.Content>
				</Empty.Root>
			{:else}
				<div class="grid grid-cols-1 gap-3">
					{#each websiteList as site (site.id)}
						<div
							class="group flex items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-sm transition-all hover:bg-muted/50"
						>
							<div class="min-w-0 flex-1">
								<a
									href={site.url}
									target="_blank"
									rel="noopener noreferrer"
									class="block truncate text-sm font-medium text-primary hover:underline hover:underline-offset-2"
								>
									{site.url}
								</a>
								{#if site.status !== undefined}
									<span
										class={cn(
											"inline-block text-xs px-2 py-1 rounded mt-1",
											site.status === 1
												? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
												: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
										)}
									>
										{site.status === 1
											? m.title_button_deployed_websites_active()
											: m.title_button_deployed_websites_inactive()}
									</span>
								{/if}
							</div>

							<div class="flex items-center gap-1 flex-shrink-0">
								<ButtonWithTooltip
									tooltip={m.tooltip_open_website()}
									variant="ghost"
									size="icon-sm"
									class="opacity-0 group-hover:opacity-100 transition-opacity"
									onclick={() => window.open(site.url, "_blank")}
								>
									<ExternalLink class="h-4 w-4" />
								</ButtonWithTooltip>

								<ButtonWithTooltip
									tooltip={m.tooltip_delete_website()}
									variant="ghost"
									size="icon-sm"
									class="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
									onclick={() => openDeleteConfirm(site.id)}
								>
									<Trash2 class="h-4 w-4" />
								</ButtonWithTooltip>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<Dialog.Footer class="flex flex-row items-center !justify-between">
			<div class="text-xs text-muted-foreground">
				{m.label_total_items
					? m.label_total_items({ count: pagination.total_items })
					: `Total: ${pagination.total_items}`}
			</div>

			{#if pagination.total_pages > 1}
				<div class="flex items-center gap-2">
					<span class="text-xs text-muted-foreground">
						{pagination.current_page} / {pagination.total_pages}
					</span>
					<div class="flex gap-1">
						<Button
							variant="outline"
							size="icon-sm"
							class="h-7 w-7"
							disabled={pagination.current_page <= 1 || isLoading}
							onclick={() => handlePageChange(pagination.current_page - 1)}
						>
							<ChevronLeft class="h-3 w-3" />
						</Button>
						<Button
							variant="outline"
							size="icon-sm"
							class="h-7 w-7"
							disabled={pagination.current_page >= pagination.total_pages || isLoading}
							onclick={() => handlePageChange(pagination.current_page + 1)}
						>
							<ChevronRight class="h-3 w-3" />
						</Button>
					</div>
				</div>
			{/if}
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={deleteConfirmDialogOpen}>
	<Dialog.Content class="min-w-[425px]">
		<Dialog.Header>
			<Dialog.Title>{m.text_button_delete()}</Dialog.Title>
		</Dialog.Header>
		<div class="py-4">
			<p class="text-sm text-muted-foreground">
				{m.text_confirm_delete_website()}
			</p>
		</div>
		<Dialog.Footer class="flex gap-2">
			<Button
				variant="outline"
				onclick={() => (deleteConfirmDialogOpen = false)}
				disabled={isDeleting}
			>
				{m.text_button_cancel()}
			</Button>
			<Button variant="destructive" onclick={confirmDelete} disabled={isDeleting}>
				{#if isDeleting}
					<Loader2 class="h-4 w-4 animate-spin mr-2" />
				{/if}
				{m.text_button_delete()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
