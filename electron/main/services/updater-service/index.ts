import { app, autoUpdater, type IpcMainInvokeEvent } from "electron";
import { broadcastService } from "../broadcast-service";

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

export class UpdaterService {
	private checkInterval: NodeJS.Timeout | null = null;
	private updateFeedUrl: string;

	constructor() {
		const server = "https://update.electronjs.org";
		const repo = "302ai/302-AI-Studio-sv";
		const version = app.getVersion();
		const platform = process.platform;

		if (platform === "darwin" || platform === "win32") {
			this.updateFeedUrl = `${server}/${repo}/${platform}-${process.arch}/${version}`;
			this.setupAutoUpdater();
			this.startAutoCheck();
		} else {
			this.updateFeedUrl = "";
			console.warn("Auto-update not supported on this platform");
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

		autoUpdater.on("update-downloaded", (_event, releaseNotes, releaseName) => {
			console.log("Update downloaded");
			broadcastService.broadcastChannelToAll("updater:update-downloaded", {
				releaseNotes,
				releaseName,
			});
		});

		autoUpdater.on("error", (error) => {
			console.error("Update error:", error);
			broadcastService.broadcastChannelToAll("updater:update-error", { message: error.message });
		});
	}

	private startAutoCheck() {
		this.checkInterval = setInterval(() => {
			this.checkForUpdates();
		}, UPDATE_CHECK_INTERVAL);
	}

	private checkForUpdates() {
		try {
			autoUpdater.checkForUpdates();
		} catch (error) {
			console.error("Failed to check for updates:", error);
		}
	}

	async checkForUpdatesManually(_event: IpcMainInvokeEvent): Promise<void> {
		this.checkForUpdates();
	}

	async quitAndInstall(_event: IpcMainInvokeEvent): Promise<void> {
		autoUpdater.quitAndInstall();
	}

	destroy() {
		if (this.checkInterval) {
			clearInterval(this.checkInterval);
			this.checkInterval = null;
		}
	}
}

export const updaterService = new UpdaterService();
