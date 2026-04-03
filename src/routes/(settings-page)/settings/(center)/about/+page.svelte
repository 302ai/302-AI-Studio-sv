<script lang="ts">
	import { goto } from "$app/navigation";
	import { appInfo } from "$lib/app-info";
	import DiscordIcon from "$lib/assets/icons/social-medias/discord.svg";
	import GithubIcon from "$lib/assets/icons/social-medias/github.svg";
	import TwitterIcon from "$lib/assets/icons/social-medias/twitter.svg";
	import { ChangelogList } from "$lib/components/buss/changelog";
	import { ModelIcon } from "$lib/components/buss/model-icon/index.js";
	import * as Avatar from "$lib/components/ui/avatar";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Calendar } from "$lib/components/ui/calendar/index.js";
	import * as Dialog from "$lib/components/ui/dialog";
	import { Label } from "$lib/components/ui/label/index.js";
	import * as Popover from "$lib/components/ui/popover";
	import * as Select from "$lib/components/ui/select/index.js";
	import { m } from "$lib/paraglide/messages";
	import { getLocale } from "$lib/paraglide/runtime";
	import { changelogState } from "$lib/stores/changelog-state.svelte";
	import { CalendarDate, type DateValue } from "@internationalized/date";
	import { Calendar as CalendarIcon, LoaderCircle } from "@lucide/svelte";
	import { createLogger } from "@shared/logger";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";

	const logger = createLogger("ui");
	const { openExternalLink } = window.electronAPI.externalLinkService;

	onMount(() => {
		// Fetch the latest 5 changelog entries
		changelogState.fetchList(5);
	});

	function handleViewMore() {
		goto("/settings/about/changelog");
	}

	// ── Export Logs Dialog State ──
	let openExportDialog = $state(false);
	let isExporting = $state(false);

	const now = new Date();
	let selectedDate = $state<DateValue>(
		new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate()),
	);
	let startHour = $state("0");
	let endHour = $state("24");

	const hours = Array.from({ length: 25 }, (_, i) => ({
		value: String(i),
		label: `${i}:00`,
	}));

	const startHourOptions = $derived(
		hours.filter((h) => parseInt(h.value, 10) < parseInt(endHour, 10)),
	);
	const endHourOptions = $derived(
		hours.filter((h) => parseInt(h.value, 10) > parseInt(startHour, 10)),
	);

	const calendarLocale = $derived(getLocale() === "zh" ? "zh-CN" : "en-US");

	// Calendar date range: last 14 days
	const minDate = $derived(
		new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate()).subtract({
			days: 13,
		}),
	);
	const maxDate = $derived(
		new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate()),
	);

	async function handleExportLogs() {
		try {
			isExporting = true;
			const dateStr = `${selectedDate.year}-${String(selectedDate.month).padStart(2, "0")}-${String(selectedDate.day).padStart(2, "0")}`;
			const startHourNum = parseInt(startHour, 10);
			const endHourNum = parseInt(endHour, 10);
			const endHourValue = endHourNum === 24 ? 23 : endHourNum;
			const result = await window.electronAPI.loggerService.exportLogs(
				dateStr,
				startHourNum,
				dateStr,
				endHourValue,
			);

			if (result === undefined) return;

			if (result) {
				toast.success(m.about_export_logs_success(), { description: result });
				openExportDialog = false;
			} else {
				toast.error(m.about_export_logs_no_logs());
			}
		} catch (error) {
			logger.error("Failed to export logs:", error);
			toast.error(m.about_export_logs_failed(), {
				description: error instanceof Error ? error.message : String(error),
			});
		} finally {
			isExporting = false;
		}
	}

	const socialMedias = [
		{
			id: 1,
			name: "Github",
			icon: GithubIcon,
			action: () => openExternalLink("https://github.com/302ai"),
		},
		{
			id: 2,
			name: "Twitter",
			icon: TwitterIcon,
			action: () => openExternalLink("https://x.com/302aiofficial"),
		},
		{
			id: 3,
			name: "Discord",
			icon: DiscordIcon,
			action: () => openExternalLink("https://discord.com/invite/4fgQ4M6ypq"),
		},
	] as const;

	const footerLinks = [
		{
			id: 1,
			name: m.title_help_center(),
			action: () => openExternalLink("https://help.302.ai/"),
		},
		{
			id: 2,
			name: m.title_terms_of_service(),
			action: () => openExternalLink("https://302.ai/terms/"),
		},
		{
			id: 3,
			name: m.title_privacy_policy(),
			action: () => openExternalLink("https://302.ai/privacy/"),
		},
		{
			id: 4,
			name: m.about_export_logs(),
			action: () => {
				openExportDialog = true;
			},
		},
	] as const;
</script>

<div class="mx-auto flex w-full flex-col items-center h-[calc(100vh-50px)] box-border">
	<div class="flex items-center justify-center py-8">
		<div class="flex items-center gap-y-[22px] flex-col">
			<ModelIcon modelName="ai302" className="size-[62px]" forceApplyClassName />
			<div class="flex items-center gap-y-2 flex-col">
				<h1 class="text-xl">{appInfo.productName}</h1>
				<p class="text-muted-foreground text-sm">{m.title_version()} {appInfo.version}</p>
			</div>
			<p class="mx-auto text-center text-muted-foreground text-sm leading-relaxed">
				{m.app_description()}
				<a
					href={appInfo.homepage}
					target="_blank"
					class="text-sm text-primary hover:underline"
					onclick={(e) => {
						e.preventDefault();
						openExternalLink(appInfo.homepage);
					}}
				>
					{appInfo.homepage}
				</a>
			</p>
		</div>
	</div>

	<!-- Changelog Section -->
	<div class="w-full px-4 pb-6 grow h-full overflow-y-auto">
		<div class="gap-settings-gap flex flex-col">
			<Label class="text-label-fg font-normal">{m.changelog_title()}</Label>
			<ChangelogList
				versions={changelogState.versions}
				currentVersion={changelogState.currentVersion}
				loading={changelogState.loading}
				error={changelogState.error}
				showViewMore={true}
				onViewMore={handleViewMore}
			/>
		</div>
	</div>

	<div class="flex items-center gap-4 py-4 w-full justify-center">
		<div class="flex items-center gap-2">
			{#each socialMedias as item (item.id)}
				<Button
					size="icon-sm"
					class="hover:bg-secondary dark:hover:bg-secondary size-8"
					variant="ghost"
					onclick={item.action}
				>
					<Avatar.Root class="rounded-sm size-6">
						<Avatar.Image src={item.icon} alt={item.name} />
					</Avatar.Root>
				</Button>
			{/each}
		</div>
		<div class="flex items-center gap-x-4">
			{#each footerLinks as item (item.id)}
				<div class="flex items-center gap-x-4">
					<Button
						variant="ghost"
						onclick={item.action}
						class="text-muted-foreground fit-content p-0 text-sm font-normal hover:bg-transparent dark:hover:bg-transparent"
					>
						{item.name}
					</Button>
				</div>
			{/each}
		</div>
	</div>
</div>

<!-- Export Logs Dialog -->
<Dialog.Root bind:open={openExportDialog}>
	<Dialog.Content class="min-w-[600px]">
		<Dialog.Header>
			<Dialog.Title>{m.about_export_logs_title()}</Dialog.Title>
			<Dialog.Description>
				{m.about_export_logs_description()}
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-row gap-4">
			<!-- Date Selection -->
			<div class="flex-1 space-y-2">
				<Label class="text-label-fg">{m.about_export_logs_date()}</Label>
				<Popover.Root>
					<Popover.Trigger class="w-full">
						<Button
							variant="outline"
							class="w-full justify-start text-left font-normal"
						>
							<CalendarIcon class="mr-2 h-4 w-4" />
							{selectedDate.year}-{String(selectedDate.month).padStart(
								2,
								"0",
							)}-{String(selectedDate.day).padStart(2, "0")}
						</Button>
					</Popover.Trigger>
					<Popover.Content class="w-auto p-0">
						<Calendar
							type="single"
							bind:value={selectedDate}
							locale={calendarLocale}
							minValue={minDate}
							maxValue={maxDate}
						/>
					</Popover.Content>
				</Popover.Root>
			</div>

			<div class="flex-1 space-y-2">
				<Label class="text-label-fg">{m.about_export_logs_start_time()}</Label>
				<Select.Root type="single" bind:value={startHour}>
					<Select.Trigger class="w-full">
						<span class="truncate"
							>{hours.find((h) => h.value === startHour)?.label}</span
						>
					</Select.Trigger>
					<Select.Content class="max-h-60 overflow-y-auto">
						{#each startHourOptions as h (h.value)}
							<Select.Item value={h.value}>{h.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="flex-1 space-y-2">
				<Label class="text-label-fg">{m.about_export_logs_end_time()}</Label>
				<Select.Root type="single" bind:value={endHour}>
					<Select.Trigger class="w-full">
						<span class="truncate">{hours.find((h) => h.value === endHour)?.label}</span
						>
					</Select.Trigger>
					<Select.Content class="max-h-60 overflow-y-auto">
						{#each endHourOptions as h (h.value)}
							<Select.Item value={h.value}>{h.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		</div>

		<Dialog.Footer>
			<Button
				variant="outline"
				onclick={() => (openExportDialog = false)}
				disabled={isExporting}
			>
				{m.common_cancel()}
			</Button>
			<Button onclick={handleExportLogs} disabled={isExporting}>
				{#if isExporting}
					<LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
				{/if}
				{isExporting ? m.about_export_logs_exporting() : m.about_export_logs_export()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
