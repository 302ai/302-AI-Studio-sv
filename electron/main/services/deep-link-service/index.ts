import { app, type IpcMainInvokeEvent } from "electron";
import { createLogger } from "@shared/logger";

const logger = createLogger("services");
import { broadcastService } from "../broadcast-service";
import { ssoService } from "../sso-service";
import { windowService } from "../window-service";

/**
 * Deep Link Protocol Handler
 *
 * Handles all deep links for the ai302studio:// protocol
 *
 * Supported paths:
 * - ai302studio://auth/callback?apikey=xxx - SSO authentication callback
 * - ai302studio://skill/import?url=xxx - Import skill from GitHub URL
 */

export interface SkillImportData {
	url: string;
}

export class DeepLinkService {
	private isInitialized = false;

	/**
	 * IPC method to simulate a deep link (for testing/debugging)
	 * Can be called from renderer: window.electronAPI.deepLinkService.simulateDeepLink(url)
	 */
	async simulateDeepLink(_event: IpcMainInvokeEvent, url: string): Promise<void> {
		logger.info("Simulating deep link:", url);
		this.handleDeepLink(url);
	}

	/**
	 * Initialize deep link protocol handler - must be called before app.ready
	 */
	initializeProtocolHandler() {
		if (this.isInitialized) {
			return;
		}

		logger.info("Initializing protocol handler");

		// Register custom protocol handler
		if (!app.isDefaultProtocolClient("ai302studio")) {
			const result = app.setAsDefaultProtocolClient("ai302studio");
			logger.info("Set as default protocol client result:", result);
		} else {
			logger.info("Already set as default protocol client");
		}

		// Handle deep links (macOS/Linux)
		app.on("open-url", (event, url) => {
			logger.info("open-url event received:", url);
			event.preventDefault();
			this.handleDeepLink(url);
		});

		this.isInitialized = true;
	}

	/**
	 * Setup second instance handler - must be called after single instance lock
	 */
	setupSecondInstanceHandler() {
		// Handle deep links (Windows) via second-instance event
		app.on("second-instance", (_event, commandLine, _workingDirectory) => {
			logger.info("second-instance handler, commandLine:", commandLine);
			// Windows: commandLine contains the deep link URL
			const url = commandLine.find((arg) => arg.startsWith("ai302studio://"));
			if (url) {
				logger.info("Found deep link:", url);
				this.handleDeepLink(url);
			}
		});
	}

	/**
	 * Handle incoming deep link (public for testing)
	 */
	handleDeepLink(url: string) {
		// Trim whitespace that might be added by copy-paste or terminal
		const trimmedUrl = url.trim();
		logger.info("Processing URL:", trimmedUrl);

		try {
			const parsedUrl = new URL(trimmedUrl);
			logger.info("Parsed URL:", {
				protocol: parsedUrl.protocol,
				host: parsedUrl.host,
				pathname: parsedUrl.pathname,
				search: parsedUrl.search,
			});

			const path = `${parsedUrl.host}${parsedUrl.pathname}`.replace(/\/$/, "");

			switch (path) {
				case "auth/callback":
					this.handleAuthCallback(parsedUrl);
					break;
				case "skill/import":
					this.handleSkillImport(parsedUrl);
					break;
				default:
					logger.warn("Unknown path:", path);
			}
		} catch (error) {
			logger.error("Failed to parse URL:", error);
		}
	}

	/**
	 * Handle SSO authentication callback
	 * URL: ai302studio://auth/callback?apikey=xxx
	 */
	private handleAuthCallback(parsedUrl: URL) {
		const apiKey = parsedUrl.searchParams.get("apikey");
		logger.info("Auth callback, API key:", apiKey ? "exists" : "missing");

		if (apiKey) {
			// Delegate to SSO service for callback handling
			ssoService.handleSsoCallbackFromServer(apiKey);
		} else {
			logger.warn("No API key in auth callback");
		}
	}

	/**
	 * Handle skill import from GitHub
	 * URL: ai302studio://skill/import?url=xxx
	 */
	private async handleSkillImport(parsedUrl: URL) {
		const githubUrl = parsedUrl.searchParams.get("url");
		logger.info("Skill import, GitHub URL:", githubUrl || "missing");

		if (!githubUrl) {
			logger.warn("No GitHub URL in skill import");
			return;
		}

		// Ensure we have a visible window
		const mainWindow = windowService.getMainWindow();
		if (mainWindow) {
			if (mainWindow.isMinimized()) {
				mainWindow.restore();
			}
			if (!mainWindow.isVisible()) {
				mainWindow.show();
			}
			mainWindow.focus();
		}

		// Open settings window to skill settings page
		await windowService.openSettingsWindow("/settings/skill-settings");

		// Broadcast the skill import event with the GitHub URL
		// Small delay to ensure the settings window is ready
		setTimeout(() => {
			const data: SkillImportData = { url: githubUrl };
			broadcastService.broadcastChannelToAll("skill:import-requested", data);
			logger.info("Broadcasted skill import event");
		}, 500);
	}
}

export const deepLinkService = new DeepLinkService();
