import { isMac } from "@electron/main/constants";
import type { UpdateChannel } from "@shared/storage/general-settings";
import { app, autoUpdater, dialog, type IpcMainInvokeEvent } from "electron";
import { broadcastService } from "../broadcast-service";
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
		const server = "https://update.electronjs.org";
		const repo = "302ai/302-AI-Studio-sv";
		let version = app.getVersion();
		const platform = process.platform;

		// For beta channel, append -beta suffix if not already present
		if (channel === "beta" && !version.includes("-beta")) {
			version = `${version}-beta`;
		}

		return `${server}/${repo}/${platform}-${process.arch}/${version}`;
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
			broadcastService.broadcastChannelToAll("updater:update-available");
		});

		autoUpdater.on("update-not-available", () => {
			console.log("Update not available");
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
			broadcastService.broadcastChannelToAll("updater:update-error", { message: error.message });
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
		try {
			autoUpdater.checkForUpdates();
		} catch (error) {
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
				UpdaterService.isInstallingUpdate = true;
				if (isMac) windowService.setCMDQ(true);
				autoUpdater.quitAndInstall();
			}
		} catch (error) {
			console.error("Failed to show update dialog:", error);
		}
	}

	private _quitAndInstall() {
		UpdaterService.isInstallingUpdate = true;
		if (isMac) windowService.setCMDQ(true);
		autoUpdater.quitAndInstall();
	}

	// ******************************* IPC Methods ******************************* //
	async checkForUpdatesManually(_event: IpcMainInvokeEvent): Promise<void> {
		this.checkForUpdates();
	}

	async quitAndInstall(_event: IpcMainInvokeEvent): Promise<void> {
		this._quitAndInstall();
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
