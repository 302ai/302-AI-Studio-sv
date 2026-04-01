import { isMac } from "@electron/main/constants";
import type { UpdateChannel } from "@shared/storage/general-settings";
import { app, autoUpdater, dialog, type IpcMainInvokeEvent } from "electron";
import { broadcastService } from "../broadcast-service";
import { localVibeService } from "../local-vibe-service";
import { generalSettingsService } from "../settings-service/general-settings-service";
import { generalSettingsStorage } from "../storage-service/general-settings-storage";
import { windowService } from "../window-service";

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

export class UpdaterService {
	private checkInterval: NodeJS.Timeout | null = null;
	private updateFeedUrl: string;
	private updateDownloaded = false;
	private static isInstallingUpdate = false;
	private currentChannel: UpdateChannel = "stable";
	private isChecking = false;

	constructor() {
		const platform = process.platform;

		if (platform === "darwin" || platform === "win32") {
			// Initialize with stable channel, will be updated in initializeAutoCheck
			this.updateFeedUrl = this.buildUpdateFeedUrl("stable");
			this.setupAutoUpdater();
			this.initializeAutoCheck();
		} else {
			this.updateFeedUrl = "";
			console.warn("Auto-update not supported on this platform");
		}
	}

	private buildUpdateFeedUrl(channel: UpdateChannel): string {
		const server = "https://updater.302.ai";
		const appId = "302-ai-studio";
		const platform = process.platform;

		if (platform === "win32") {
			// Windows Squirrel expects base URL without version
			// It will automatically request /RELEASES file
			return `${server}/update/${appId}/${channel}/${platform}/${process.arch}`;
		}

		// macOS Squirrel needs version in URL for update check
		const version = app.getVersion();
		return `${server}/update/${appId}/${channel}/${platform}/${process.arch}/${version}`;
	}

	private updateFeedUrlForChannel(channel: UpdateChannel) {
		this.currentChannel = channel;
		this.updateFeedUrl = this.buildUpdateFeedUrl(channel);
		autoUpdater.setFeedURL({ url: this.updateFeedUrl });
		console.log(`Update feed URL set to: ${this.updateFeedUrl} (channel: ${channel})`);
	}

	// ******************************* Private Methods ******************************* //
	private async initializeAutoCheck() {
		// Read initial settings
		const autoUpdate = await generalSettingsStorage.getAutoUpdate();
		const updateChannel = await generalSettingsStorage.getUpdateChannel();

		// Update feed URL based on channel
		this.updateFeedUrlForChannel(updateChannel);

		if (autoUpdate) {
			setTimeout(() => {
				this.checkForUpdates();
			}, 1000);
			this.startAutoCheck();
		}
	}

	private setupAutoUpdater() {
		autoUpdater.setFeedURL({ url: this.updateFeedUrl });

		autoUpdater.on("checking-for-update", () => {
			console.log("Checking for updates...");
			broadcastService.broadcastChannelToAll("updater:update-checking");
		});

		autoUpdater.on("update-available", () => {
			console.log("Update available");
			this.isChecking = false;
			broadcastService.broadcastChannelToAll("updater:update-available");
		});

		autoUpdater.on("update-not-available", () => {
			console.log("Update not available");
			this.isChecking = false;
			broadcastService.broadcastChannelToAll("updater:update-not-available");
		});

		autoUpdater.on("update-downloaded", async (_event, releaseNotes, releaseName) => {
			console.log("Update downloaded");
			this.updateDownloaded = true;
			broadcastService.broadcastChannelToAll("updater:update-downloaded", {
				releaseNotes,
				releaseName,
			});

			// Show native dialog
			await this.showUpdateDownloadedDialog();
		});

		autoUpdater.on("error", (error) => {
			console.error("Update error:", error);
			this.isChecking = false;

			// Check if this is a "no releases available" error (common on Windows)
			// These errors should be treated as "no update available" rather than errors
			const errorMessage = error.message || "";
			const isNoReleasesError =
				errorMessage.includes("empty or corrupted") ||
				errorMessage.includes("RELEASES") ||
				errorMessage.includes("404") ||
				errorMessage.includes("Not Found");

			if (isNoReleasesError) {
				console.log("No releases available on server, treating as no update available");
				broadcastService.broadcastChannelToAll("updater:update-not-available");
			} else {
				broadcastService.broadcastChannelToAll("updater:update-error", {
					message: error.message,
				});
			}
		});
	}

	private startAutoCheck() {
		if (this.checkInterval) {
			this.stopAutoCheck();
		}

		this.checkInterval = setInterval(() => {
			this.checkForUpdates();
		}, UPDATE_CHECK_INTERVAL);

		console.log("Auto-update check enabled");
	}

	private stopAutoCheck() {
		if (this.checkInterval) {
			clearInterval(this.checkInterval);
			this.checkInterval = null;
			console.log("Auto-update check disabled");
		}
	}

	private checkForUpdates() {
		if (this.isChecking) {
			console.log("Update check already in progress, skipping...");
			return;
		}

		try {
			this.isChecking = true;
			autoUpdater.checkForUpdates();
		} catch (error) {
			this.isChecking = false;
			console.error("Failed to check for updates:", error);
		}
	}

	private async showUpdateDownloadedDialog() {
		try {
			const language = await generalSettingsService.getLanguage();

			const messages = {
				zh: {
					title: "更新已下载完成",
					message: "新版本已下载完成，是否立即重启更新？",
					buttons: ["立即重启", "稍后再说"],
				},
				en: {
					title: "Update Downloaded",
					message:
						"A new version has been downloaded. Would you like to restart and install it now?",
					buttons: ["Restart Now", "Later"],
				},
			};

			const msg = messages[language] || messages.en;

			const { response } = await dialog.showMessageBox({
				type: "info",
				title: msg.title,
				message: msg.message,
				buttons: msg.buttons,
				defaultId: 0,
				cancelId: 1,
			});

			if (response === 0) {
				// User clicked "Restart Now"
				await this._quitAndInstall();
			}
		} catch (error) {
			console.error("Failed to show update dialog:", error);
		}
	}

	private async _quitAndInstall() {
		// Set this flag immediately to prevent other quit handlers (like window-all-closed or before-quit)
		// from trying to stop the sandbox concurrently.
		UpdaterService.isInstallingUpdate = true;

		try {
			console.log("[Updater] Force stopping podman before update install...");
			await localVibeService.forceStopPodman();
			console.log("[Updater] Podman force stopped");
		} catch (error) {
			console.error("[Updater] forceStopPodman failed (proceeding):", error);
		}

		if (isMac) windowService.setCMDQ(true);

		autoUpdater.quitAndInstall();
	}

	// ******************************* IPC Methods ******************************* //
	async checkForUpdatesManually(_event: IpcMainInvokeEvent): Promise<void> {
		this.checkForUpdates();
	}

	async quitAndInstall(_event: IpcMainInvokeEvent): Promise<void> {
		await this._quitAndInstall();
	}

	static isInstallingUpdateNow(): boolean {
		return UpdaterService.isInstallingUpdate;
	}

	async isUpdateDownloaded(_event: IpcMainInvokeEvent): Promise<boolean> {
		return this.updateDownloaded;
	}

	async setAutoUpdate(_event: IpcMainInvokeEvent, enabled: boolean): Promise<void> {
		if (enabled) {
			this.startAutoCheck();
		} else {
			this.stopAutoCheck();
		}
	}

	async setUpdateChannel(_event: IpcMainInvokeEvent, channel: UpdateChannel): Promise<void> {
		this.updateFeedUrlForChannel(channel);
		// If auto-update is enabled, check for updates immediately with new channel
		const autoUpdate = await generalSettingsStorage.getAutoUpdate();
		if (autoUpdate) {
			setTimeout(() => {
				this.checkForUpdates();
			}, 500);
		}
	}

	async getUpdateChannel(_event: IpcMainInvokeEvent): Promise<UpdateChannel> {
		return this.currentChannel;
	}

	destroy() {
		this.stopAutoCheck();
	}
}

export const updaterService = new UpdaterService();
