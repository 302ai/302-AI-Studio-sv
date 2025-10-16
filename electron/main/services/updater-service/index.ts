import { app, autoUpdater, dialog, type IpcMainInvokeEvent } from "electron";
import { broadcastService } from "../broadcast-service";
import { generalSettingsService } from "../settings-service/general-settings-service";
import { generalSettingsStorage } from "../storage-service/general-settings-storage";

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

export class UpdaterService {
	private checkInterval: NodeJS.Timeout | null = null;
	private updateFeedUrl: string;
	private updateDownloaded = false;
	private static isInstallingUpdate = false;

	constructor() {
		const server = "https://update.electronjs.org";
		const repo = "302ai/302-AI-Studio-sv";
		const version = app.getVersion();
		const platform = process.platform;

		if (platform === "darwin" || platform === "win32") {
			this.updateFeedUrl = `${server}/${repo}/${platform}-${process.arch}/${version}`;
			this.setupAutoUpdater();
			this.initializeAutoCheck();
		} else {
			this.updateFeedUrl = "";
			console.warn("Auto-update not supported on this platform");
		}
	}

	// ******************************* Private Methods ******************************* //
	private async initializeAutoCheck() {
		// Read initial autoUpdate setting
		const autoUpdate = await generalSettingsStorage.getAutoUpdate();
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
				autoUpdater.quitAndInstall();
			}
		} catch (error) {
			console.error("Failed to show update dialog:", error);
		}
	}

	// ******************************* IPC Methods ******************************* //
	async checkForUpdatesManually(_event: IpcMainInvokeEvent): Promise<void> {
		this.checkForUpdates();
	}

	async quitAndInstall(_event: IpcMainInvokeEvent): Promise<void> {
		UpdaterService.isInstallingUpdate = true;
		autoUpdater.quitAndInstall();
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

	destroy() {
		this.stopAutoCheck();
	}
}

export const updaterService = new UpdaterService();
