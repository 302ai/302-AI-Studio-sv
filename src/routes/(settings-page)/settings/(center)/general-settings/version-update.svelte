<script lang="ts">
	import { goto } from "$app/navigation";
	import { appInfo } from "$lib/app-info";
	import { ChangelogItem } from "$lib/components/buss/changelog";
	import {
		SettingInfoItem,
		SettingSelectItem,
		SettingSwitchItem,
	} from "$lib/components/buss/settings";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Skeleton } from "$lib/components/ui/skeleton/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { changelogState } from "$lib/stores/changelog-state.svelte";
	import { generalSettings } from "$lib/stores/general-settings.state.svelte";
	import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
	import Loader2Icon from "@lucide/svelte/icons/loader-2";
	import type { UpdateChannel } from "@shared/storage/general-settings";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";
	import { createLogger } from "@shared/logger";

	const logger = createLogger("ui");

	const { updaterService } = window.electronAPI;
	const {
		onUpdateChecking,
		onUpdateAvailable,
		onUpdateNotAvailable,
		onUpdateDownloaded,
		onUpdateError,
	} = window.electronAPI.updater;

	let checking = $state(false);
	let downloading = $state(false);
	let updateDownloaded = $state(false);

	let isUpdating = $derived(checking || downloading);

	// Check if there's a newer version available based on changelog
	let hasNewerVersion = $derived(changelogState.hasNewerVersion());
	let latestVersionNumber = $derived(changelogState.latestVersion?.version ?? null);

	const updateChannelOptions = [
		{ value: "stable" as UpdateChannel, label: m.update_channel_stable() },
		{ value: "beta" as UpdateChannel, label: m.update_channel_beta() },
	];
	let statusText = $derived(
		updateDownloaded
			? m.restart_to_update()
			: checking
				? m.checking_update()
				: downloading
					? m.downloading_update()
					: m.check_update(),
	);

	async function handleCheckUpdate() {
		checking = true;
		try {
			await updaterService.checkForUpdatesManually();
		} catch (_error) {
			toast.error(m.update_error());
			checking = false;
		}
	}

	async function handleRestartToUpdate() {
		try {
			await updaterService.quitAndInstall();
		} catch (_error) {
			toast.error(m.update_error());
		}
	}

	onMount(async () => {
		try {
			const isDownloaded = await updaterService.isUpdateDownloaded();
			updateDownloaded = isDownloaded;
		} catch (error) {
			logger.error("Failed to check update status:", error);
		}

		// Fetch the latest changelog
		changelogState.fetchLatest();
	});

	function handleViewFullChangelog() {
		goto("/settings/about/changelog");
	}

	onMount(() => {
		const cleanupChecking = onUpdateChecking(() => {
			checking = true;
		});

		const cleanupAvailable = onUpdateAvailable(() => {
			checking = false;
			downloading = true;
			toast.success(m.update_available());
		});

		const cleanupNotAvailable = onUpdateNotAvailable(() => {
			checking = false;
			downloading = false;
			toast.success(m.update_not_available());
		});

		const cleanupDownloaded = onUpdateDownloaded((_data) => {
			checking = false;
			downloading = false;
			updateDownloaded = true;
		});

		const cleanupError = onUpdateError((data) => {
			checking = false;
			downloading = false;
			toast.error(m.update_error(), {
				description: data.message,
			});
		});

		return () => {
			cleanupChecking?.();
			cleanupAvailable?.();
			cleanupNotAvailable?.();
			cleanupDownloaded?.();
			cleanupError?.();
		};
	});
</script>

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg font-normal">{m.version_update()}</Label>
	<SettingSwitchItem
		label={m.auto_update()}
		checked={generalSettings.autoUpdate}
		onCheckedChange={(v) => generalSettings.setAutoUpdate(v)}
	/>
	<SettingSelectItem
		label={m.update_channel()}
		description={m.update_channel_desc()}
		options={updateChannelOptions}
		value={generalSettings.updateChannel}
		onValueChange={(v) => generalSettings.setUpdateChannel(v as UpdateChannel)}
	/>
	{#snippet updateButton()}
		<Button
			size="sm"
			onclick={updateDownloaded ? handleRestartToUpdate : handleCheckUpdate}
			disabled={isUpdating}
		>
			{statusText}
			{#if isUpdating}
				<Loader2Icon class="animate-spin w-4 h-4" />
			{/if}
		</Button>
	{/snippet}

	<SettingInfoItem label={m.version_information()} value={appInfo.version} action={updateButton} />

	<!-- New version notification -->
	{#if hasNewerVersion && latestVersionNumber}
		<div
			class="rounded-settings-item bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3"
		>
			<p class="text-sm text-amber-700 dark:text-amber-300">
				{m.changelog_new_version_available({ version: latestVersionNumber })}
			</p>
		</div>
	{/if}

	<!-- Latest changelog display -->
	<div class="flex flex-col gap-2">
		{#if changelogState.loadingLatest}
			<Skeleton class="h-14 w-full rounded-settings-item" />
		{:else if changelogState.latestVersion}
			<ChangelogItem
				version={changelogState.latestVersion}
				isCurrentVersion={changelogState.isCurrentVersion(changelogState.latestVersion.version)}
				defaultOpen={true}
			/>
			<Button
				variant="link"
				class="self-start text-sm p-0 h-auto"
				onclick={handleViewFullChangelog}
			>
				{m.changelog_view_full()}
				<ChevronRightIcon class="size-4 ml-1" />
			</Button>
		{/if}
	</div>
</div>
