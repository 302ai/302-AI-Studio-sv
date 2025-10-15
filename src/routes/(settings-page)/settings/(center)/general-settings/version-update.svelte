<script lang="ts">
	import { appInfo } from "$lib/app-info";
	import { SettingInfoItem, SettingSwitchItem } from "$lib/components/buss/settings";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { generalSettings } from "$lib/stores/general-settings.state.svelte";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";

	const { updaterService } = window.electronAPI;
	const {
		onUpdateChecking,
		onUpdateAvailable,
		onUpdateNotAvailable,
		onUpdateDownloaded,
		onUpdateError,
	} = window.electronIPC;

	let checking = $state(false);

	async function handleCheckUpdate() {
		checking = true;
		console.log("Checking for updates...");
		try {
			await updaterService.checkForUpdatesManually();
		} catch (error) {
			console.error("Failed to check for updates:", error);
			toast.error("检查更新失败");
			checking = false;
		}
	}

	onMount(() => {
		console.log("[Frontend] Registering update event listeners...");
		console.log("[Frontend] window.electronIPC available:", !!window.electronIPC);
		console.log("[Frontend] onUpdateChecking available:", !!window.electronIPC?.onUpdateChecking);

		const cleanupChecking = onUpdateChecking(() => {
			console.log("[Frontend] Received: update-checking");
			checking = true;
			toast.info("正在检查更新...");
		});

		const cleanupAvailable = onUpdateAvailable(() => {
			console.log("[Frontend] Received: update-available");
			checking = false;
			toast.success("发现新版本！正在下载...");
		});

		const cleanupNotAvailable = onUpdateNotAvailable(() => {
			console.log("[Frontend] Received: update-not-available");
			checking = false;
			toast.success("当前已是最新版本");
		});

		const cleanupDownloaded = onUpdateDownloaded((data) => {
			console.log("[Frontend] Received: update-downloaded", data);
			checking = false;
			toast.success(`新版本 ${data.releaseName} 下载完成！`, {
				description: "重启应用以安装更新",
				action: {
					label: "重启",
					onClick: () => updaterService.quitAndInstall(),
				},
			});
		});

		const cleanupError = onUpdateError((data) => {
			console.log("[Frontend] Received: update-error", data);
			checking = false;
			toast.error("更新失败", {
				description: data.message,
			});
		});

		console.log("[Frontend] Update event listeners registered");

		return () => {
			console.log("[Frontend] Cleaning up update event listeners");
			cleanupChecking?.();
			cleanupAvailable?.();
			cleanupNotAvailable?.();
			cleanupDownloaded?.();
			cleanupError?.();
		};
	});
</script>

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg">{m.version_update()}</Label>
	<SettingSwitchItem
		label={m.auto_update()}
		checked={generalSettings.autoUpdate}
		onCheckedChange={(v) => generalSettings.setAutoUpdate(v)}
	/>
	{#snippet updateButton()}
		<Button size="sm" onclick={handleCheckUpdate} disabled={checking}>
			{checking ? "检查中..." : m.check_update()}
		</Button>
	{/snippet}

	<SettingInfoItem label={m.version_information()} value={appInfo.version} action={updateButton} />
</div>
