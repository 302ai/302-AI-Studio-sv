import { getLocalSandboxHealthStatus } from "@electron/main/apis/code-agent";
import { PLATFORM } from "@electron/main/constants/index";
import { OPENCLAW_DEFAULT_CONFIG } from "@electron/main/datas/openclaw-template";
import { broadcastService } from "@electron/main/services/broadcast-service";
import { generalSettingsService } from "@electron/main/services/settings-service/general-settings-service";
import { storageService } from "@electron/main/services/storage-service";
import { localVibeStorage } from "@electron/main/services/storage-service/code-agent/local-vibe-storage";
import { providerStorage } from "@electron/main/services/storage-service/provider-storage";
import { isCommandNotFound } from "@electron/main/utils/cmd";
import { exec, spawn, type SpawnOptions } from "child_process";
import { app, shell, type IpcMainInvokeEvent } from "electron";
import { get, set } from "es-toolkit/compat";
import { isNull } from "es-toolkit/predicate";
import fs from "fs";
import { cp, readdir } from "fs/promises";
import getPort from "get-port";
import path from "path";
import { match } from "ts-pattern";
import { promisify } from "util";
import { CRON_EXPRESSION, schedulerService } from "../scheduler-service";

const execAsync = promisify(exec);

/** Default port for local sandbox API */
export const DEFAULT_SANDBOX_PORT = 8123;
export const DEFAULT_OPENCLAW_PORT = 18123;

export class LocalVibeService {
	/** Default port for local sandbox API */
	private runtimePort: number | null = null;
	/** Default port for openclaw API */
	private runtimeOpenClawPort: number | null = null;
	private isOperating = false;

	constructor() {
		try {
			const dir = this.getRuntimeComposeDir();
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
		} catch (error) {
			console.error("[LocalVibeService] Failed to initialize runtime directory:", error);
		}
	}

	/**
	 * Copy a file or directory from host system to workspace via IPC
	 */
	async copyToWorkspaceByIpc(
		_event: IpcMainInvokeEvent,
		sourcePath: string,
		containerPath: string,
	): Promise<{ success: boolean; error?: string }> {
		return this._copyToWorkspace(sourcePath, containerPath);
	}

	/**
	 * Core logic for copying to workspace
	 */
	private async _copyToWorkspace(
		sourcePath: string,
		containerPath: string,
	): Promise<{ success: boolean; error?: string }> {
		try {
			const composeDir = this.getRuntimeComposeDir();
			// The container maps ${HOST_DATA_PATH} (composeDir) to /home/user
			const CONTAINER_ROOT = "/home/user";

			let targetPath: string;

			// Normalize container path to ensure we can match the prefix
			// On Windows, incoming path might still use forward slashes from frontend
			const normalizedContainerPath = containerPath.replace(/\\/g, "/");

			if (normalizedContainerPath.startsWith(CONTAINER_ROOT)) {
				// Strip /home/user to map to composeDir
				const relativePath = normalizedContainerPath.substring(CONTAINER_ROOT.length);
				const safeRelativePath = relativePath.replace(/\.\./g, "");
				targetPath = path.join(composeDir, safeRelativePath);
			} else if (path.isAbsolute(containerPath)) {
				targetPath = containerPath;
			} else {
				// Fallback: assume relative to workspace if not starting with /home/user
				const workspaceDir = path.join(composeDir, "workspace");
				const safeSubPath = normalizedContainerPath.replace(/\.\./g, "");
				const cleanSubPath = safeSubPath.startsWith("/") ? safeSubPath.substring(1) : safeSubPath;
				targetPath = path.join(workspaceDir, cleanSubPath);
			}

			// Ensure target directory exists
			const targetDir = path.dirname(targetPath);
			if (!fs.existsSync(targetDir)) {
				fs.mkdirSync(targetDir, { recursive: true });
			}

			console.log(`[LocalVibeService] Copying ${sourcePath} to ${targetPath}`);
			await cp(sourcePath, targetPath, { recursive: true });

			return { success: true };
		} catch (error) {
			console.error("[LocalVibeService] Copy to workspace failed:", error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			return { success: false, error: errorMessage };
		}
	}

	// Localization helper method
	private async t(zh: string, en: string): Promise<string> {
		const language = await generalSettingsService.getLanguage();
		return language === "zh" ? zh : en;
	}

	/**
	 * Get the runtime port
	 */
	public getRuntimePort(): number | null {
		return this.runtimePort;
	}

	/**
	 * Get the runtime openclaw port
	 */
	public getRuntimeOpenClawPort(): number | null {
		return this.runtimeOpenClawPort;
	}

	/**
	 * Get the path to openclaw.json
	 */
	public getOpenClawConfigPath(): string {
		return path.join(this.getRuntimeComposeDir(), ".openclaw", "openclaw.json");
	}

	/**
	 * Get the path to docker-compose.yml
	 * In development: static/docker-compose.yml in project root
	 * In production: docker-compose.yml in app resources directory
	 */
	private getDockerComposePath(): string {
		if (app.isPackaged) {
			return path.join(process.resourcesPath, "docker-compose.yml");
		}
		return path.join(process.cwd(), "static", "docker-compose.yml");
	}

	/**
	 * Get the runtime compose directory
	 * In development: <project-root>/ai302
	 * In production (macOS): <documents>/ai302
	 * In production (others): <home>/ai302 (e.g. C:\Users\{username}\ai302 on Windows)
	 */
	private getRuntimeComposeDir(): string {
		return match(app.isPackaged)
			.with(true, () =>
				match(PLATFORM.IS_MAC)
					.with(true, () => path.join(app.getPath("documents"), "ai302"))
					.otherwise(() => path.join(app.getPath("home"), "ai302")),
			)
			.otherwise(() => path.join(process.cwd(), "ai302"));
	}

	/**
	 * Get the runtime compose file path
	 */
	private getRuntimeComposePath(): string {
		return path.join(this.getRuntimeComposeDir(), "docker-compose.yml");
	}

	/**
	 * Get the runtime compose directory path via IPC
	 */
	async getComposeDirectory(_event: IpcMainInvokeEvent): Promise<string> {
		return this.getRuntimeComposeDir();
	}

	/**
	 * Open the runtime compose directory in system explorer via IPC
	 */
	async openComposeDirectory(_event: IpcMainInvokeEvent): Promise<boolean> {
		const dir = this.getRuntimeComposeDir();
		try {
			const error = await shell.openPath(dir);
			return error === "";
		} catch (error) {
			console.error("[LocalVibeService] Failed to open compose directory:", error);
			return false;
		}
	}

	/**
	 * Open a specific workspace directory in system explorer via IPC
	 */
	async openWorkspaceDirectory(_event: IpcMainInvokeEvent, subPath: string): Promise<boolean> {
		const composeDir = this.getRuntimeComposeDir();
		const workspaceDir = path.join(composeDir, "workspace");

		// Prevent directory traversal
		const safeSubPath = subPath.replace(/\.\./g, "");
		const targetDir = path.join(workspaceDir, safeSubPath);

		try {
			const error = await shell.openPath(targetDir);
			if (error) {
				console.error("[LocalVibeService] Failed to open path:", targetDir, error);
				return false;
			}
			return true;
		} catch (error) {
			console.error("[LocalVibeService] Failed to open workspace directory:", error);
			return false;
		}
	}

	/**
	 * Delete a specific workspace directory via IPC
	 * @param subPath - subdirectory name under workspace (e.g. "icr6cz4lnm")
	 */
	async deleteWorkspaceDirectory(
		_event: IpcMainInvokeEvent,
		subPath: string,
	): Promise<{ success: boolean; error?: string }> {
		const composeDir = this.getRuntimeComposeDir();
		const workspaceDir = path.join(composeDir, "workspace");

		// Prevent directory traversal
		const safeSubPath = subPath.replace(/\.\./g, "");
		const targetDir = path.join(workspaceDir, safeSubPath);

		// Safety: ensure targetDir is actually inside workspaceDir
		if (!targetDir.startsWith(workspaceDir)) {
			console.error("[LocalVibeService] Path traversal attempt blocked:", subPath);
			return { success: false, error: "Invalid path" };
		}

		try {
			if (fs.existsSync(targetDir)) {
				fs.rmSync(targetDir, { recursive: true, force: true });
				console.log("[LocalVibeService] Deleted workspace directory:", targetDir);
			}
			return { success: true };
		} catch (error) {
			console.error("[LocalVibeService] Failed to delete workspace directory:", error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Rename a workspace directory via IPC
	 * @param oldSubPath - old subdirectory path relative to workspace (e.g. "projects/myFolder")
	 * @param newSubPath - new subdirectory path relative to workspace (e.g. "projects/newFolder")
	 */
	async renameWorkspaceDirectory(
		_event: IpcMainInvokeEvent,
		oldSubPath: string,
		newSubPath: string,
	): Promise<{ success: boolean; error?: string }> {
		const composeDir = this.getRuntimeComposeDir();
		const workspaceDir = path.join(composeDir, "workspace");

		// Prevent directory traversal
		const safeOldPath = oldSubPath.replace(/\.\./g, "");
		const safeNewPath = newSubPath.replace(/\.\./g, "");
		const oldDir = path.join(workspaceDir, safeOldPath);
		const newDir = path.join(workspaceDir, safeNewPath);

		// Safety: ensure both paths are inside workspaceDir
		if (!oldDir.startsWith(workspaceDir) || !newDir.startsWith(workspaceDir)) {
			console.error("[LocalVibeService] Path traversal attempt blocked:", oldSubPath, newSubPath);
			return { success: false, error: "Invalid path" };
		}

		try {
			if (!fs.existsSync(oldDir)) {
				return { success: false, error: "Source path not found" };
			}
			fs.renameSync(oldDir, newDir);
			console.log("[LocalVibeService] Renamed workspace directory:", oldDir, "->", newDir);
			return { success: true };
		} catch (error) {
			console.error("[LocalVibeService] Failed to rename workspace directory:", error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			return { success: false, error: errorMessage };
		}
	}

	/**
	 * List existing work directories in ai302/workspace
	 * Returns array of directory names (not full paths)
	 */
	async listWorkspaceDirectories(_event: IpcMainInvokeEvent): Promise<string[]> {
		const composeDir = this.getRuntimeComposeDir();
		const workspaceDir = path.join(composeDir, "workspace");

		try {
			// Use readdir with withFileTypes to filter directories
			const entries = await readdir(workspaceDir, { withFileTypes: true });

			// Filter and return only directory names, sorted alphabetically
			return entries
				.filter((entry) => entry.isDirectory())
				.map((entry) => entry.name)
				.sort();
		} catch (error) {
			// If workspace doesn't exist or no permissions, return empty array
			console.log("[EnvService] Failed to list workspace directories:", error);
			return [];
		}
	}

	/**
	 * Get the local base URL for the runtime via IPC
	 */
	async getLocalBaseUrl(_event: IpcMainInvokeEvent): Promise<string | null> {
		const port = this.getRuntimePort();
		if (!port) return null;
		return `http://localhost:${port}`;
	}

	/**
	 * Get the current sandbox status via IPC
	 * Used by new renderer windows to sync their state
	 */
	async getSandboxStatus(_event: IpcMainInvokeEvent): Promise<{
		isRunning: boolean;
		isOperating: boolean;
		isOcHealth: boolean;
	}> {
		// sandboxStatus === 'running': verify with an actual health check
		const result = await this.checkLocalSandboxHealth();
		return {
			isRunning: result.isHealth,
			isOperating: this.isOperating,
			isOcHealth: result.isOcHealth,
		};
	}

	/**
	 * Trigger system restart (Windows only)
	 * Called when WSL enablement requires a system restart
	 */
	async triggerSystemRestart(_event: IpcMainInvokeEvent): Promise<{ isOk: boolean }> {
		if (process.platform !== "win32") {
			console.log("[LocalVibeService] System restart not supported on this platform");
			return { isOk: false };
		}

		try {
			console.log("[LocalVibeService] Triggering system restart in 10 seconds...");
			// Use shutdown command to restart after 10 seconds
			// /r = restart, /t 10 = 10 second delay
			await execAsync("shutdown /r /t 10");
			console.log("[LocalVibeService] System restart scheduled");
			return { isOk: true };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("[LocalVibeService] Failed to trigger system restart:", errorMessage);
			return { isOk: false };
		}
	}

	/**
	 * Prepare runtime environment for docker-compose
	 * - Copies template compose to runtime directory
	 * - Detects available port (starting from DEFAULT_SANDBOX_PORT)
	 * - Writes .env file with AI302_API_KEY, HOST_DATA_PATH, and HOST_PORT
	 * @param apiKey The API key to inject
	 * @returns The allocated host port
	 */
	private async prepareRuntimeCompose(apiKey: string): Promise<number> {
		const templatePath = this.getDockerComposePath();
		const runtimeDir = this.getRuntimeComposeDir();
		const runtimeComposePath = this.getRuntimeComposePath();
		const envFilePath = path.join(runtimeDir, ".env");
		const dbDir = path.join(runtimeDir, "db");
		const workspaceDir = path.join(runtimeDir, "workspace");
		const openclawDir = path.join(runtimeDir, ".openclaw");
		const dbFilePath = path.join(dbDir, "app.db");
		const openclawFilePath = path.join(openclawDir, "openclaw.json");

		// Copy template compose to runtime directory
		fs.copyFileSync(templatePath, runtimeComposePath);

		// Normalize known short-name image to a fully-qualified reference for Podman compatibility.
		// Some environments disable unqualified-search registries in /etc/containers/registries.conf.
		try {
			const composeContent = fs.readFileSync(runtimeComposePath, "utf-8");
			const normalizedContent = composeContent.replace(
				/(\bimage:\s*)proxy302\/claude_code_local_api:dev\b/g,
				"$1docker.io/proxy302/claude_code_local_api:dev",
			);
			if (normalizedContent !== composeContent) {
				fs.writeFileSync(runtimeComposePath, normalizedContent, "utf-8");
			}
		} catch (error) {
			console.warn("[Local Vibe] Failed to normalize runtime compose image reference:", error);
		}

		// Ensure bind-mounted directories are writable by the container user.
		// Rootless Podman containers often run with a different uid/gid than the host user.
		for (const dir of [runtimeDir, dbDir, workspaceDir, openclawDir]) {
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			try {
				fs.chmodSync(dir, 0o777);
			} catch (error) {
				console.warn("[Local Vibe] Failed to set writable permissions for:", dir, error);
			}
		}

		try {
			if (!fs.existsSync(dbFilePath)) {
				fs.writeFileSync(dbFilePath, "", "utf-8");
			}
			fs.chmodSync(dbFilePath, 0o666);
		} catch (error) {
			console.warn("[Local Vibe] Failed to prepare runtime sqlite file:", error);
		}

		try {
			// Always start with template as base
			const templateConfig = JSON.parse(JSON.stringify(OPENCLAW_DEFAULT_CONFIG)) as Record<
				string,
				unknown
			>;

			// Set API keys in template for all providers
			if (apiKey) {
				const templateProviders = get(templateConfig, "models.providers") as
					| Record<string, Record<string, unknown>>
					| undefined;
				if (templateProviders) {
					for (const providerName of Object.keys(templateProviders)) {
						set(templateConfig, `models.providers.${providerName}.apiKey`, apiKey);
					}
				}
			}

			// Merge app-models into template config
			await this._mergeModelsIntoOpenclawConfig(templateConfig);

			let finalConfig: Record<string, unknown>;

			if (!fs.existsSync(openclawFilePath)) {
				// New file: use template directly
				finalConfig = templateConfig;
				console.log("[Local Vibe] Creating new openclaw.json");
			} else {
				// Existing file: merge template's new fields into existing config
				const existingContent = fs.readFileSync(openclawFilePath, "utf-8");
				const existingConfig = JSON.parse(existingContent) as Record<string, unknown>;
				finalConfig = this._mergeTemplateIntoExistingConfig(existingConfig, templateConfig);
				console.log("[Local Vibe] Merged template updates into existing openclaw.json");
			}

			// Always update API key to latest value (force update) for all providers
			if (apiKey) {
				const providers = get(finalConfig, "models.providers") as
					| Record<string, Record<string, unknown>>
					| undefined;
				if (providers) {
					for (const providerName of Object.keys(providers)) {
						set(finalConfig, `models.providers.${providerName}.apiKey`, apiKey);
					}
				}
			}

			const presetContent = JSON.stringify(finalConfig, null, 2);
			fs.writeFileSync(openclawFilePath, presetContent, "utf-8");
			fs.chmodSync(openclawFilePath, 0o666);
		} catch (error) {
			console.warn("[Local Vibe] Failed to prepare openclaw.json file:", error);
		}

		// Find available port for Sandbox (starting from default, will find next available if occupied)
		const preferredPort = isNull(this.runtimePort) ? DEFAULT_SANDBOX_PORT : this.runtimePort + 1;
		const hostPort = await getPort({ port: preferredPort });

		// Store the allocated port
		this.runtimePort = hostPort;

		// Find available port for OpenClaw
		const preferredOpenClawPort = isNull(this.runtimeOpenClawPort)
			? DEFAULT_OPENCLAW_PORT
			: this.runtimeOpenClawPort + 1;
		const openClawPort = await getPort({
			port: [preferredOpenClawPort, DEFAULT_OPENCLAW_PORT],
		});

		// Store the allocated port
		this.runtimeOpenClawPort = openClawPort;

		// Write .env file with runtime values
		const envContent = [
			`AI302_API_KEY=${apiKey}`,
			`HOST_DATA_PATH=${runtimeDir}`,
			`HOST_PORT=${hostPort}`,
			`OPENCLAW_PORT=${openClawPort}`,
		].join("\n");
		fs.writeFileSync(envFilePath, envContent, "utf-8");

		console.log("[Local Vibe] Runtime compose prepared at:", runtimeDir);
		console.log("[Local Vibe] Allocated host port:", hostPort);
		console.log("[Local Vibe] Allocated OpenClaw port:", openClawPort);

		return hostPort;
	}

	/**
	 * Execute podman compose up -d
	 * Runs podman compose in detached mode to start services
	 * Prepares runtime compose with .env file before starting
	 * @returns { isOk: boolean; port?: number; output?: string; error?: string }
	 */
	private async runPodmanComposeUp(): Promise<{
		isOk: boolean;
		port?: number;
		openClawPort?: number;
		output?: string;
		error?: string;
	}> {
		try {
			// Get API key from provider storage
			const { valid, apiKey } = await providerStorage.validate302AIProvider();
			if (!valid || !apiKey) {
				console.warn("[Local Vibe] No valid 302AI API key found, proceeding without injection");
			}

			// Prepare runtime compose with .env file (includes port detection)
			const hostPort = await this.prepareRuntimeCompose(apiKey);
			const openClawPort = this.getRuntimeOpenClawPort() ?? DEFAULT_OPENCLAW_PORT;

			const composePath = this.getRuntimeComposePath();
			const runtimeDir = this.getRuntimeComposeDir();

			// Auto-pull latest images before starting
			// This ensures we have the latest version for the current platform
			const pullResult = await this.runPodmanComposePull();
			if (!pullResult.isOk) {
				console.warn("[Local Vibe] Auto-pull failed, trying to start anyway:", pullResult.error);
			}

			// Execute: podman-compose -f <path> up -d --force-recreate
			// Use broadcast to show progress
			// Set cwd to runtimeDir so podman-compose can read the .env file
			const result = await this.runCommandWithBroadcast(
				"podman-compose",
				["-f", `"${composePath}"`, "up", "-d", "--force-recreate"],
				"podman-compose-up",
				true,
				runtimeDir,
			);

			if (!result.isOk) {
				const errorMessage = result.output;
				// Check if podman-compose command is not found
				if (isCommandNotFound(errorMessage)) {
					const notInstalledMsg = await this.t(
						"podman-compose 未安装。请先安装 podman-compose。",
						"podman-compose is not installed. Please install podman-compose first.",
					);
					console.error("[Local Vibe] podman-compose up -d error:", notInstalledMsg);
					return { isOk: false, error: notInstalledMsg };
				}

				console.error("[Local Vibe] podman-compose up -d error:", errorMessage);
				return { isOk: false, error: errorMessage };
			}

			console.log("[Local Vibe] podman-compose up -d:", result.output);
			return { isOk: true, port: hostPort, openClawPort, output: result.output };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("[Local Vibe] podman-compose up -d error:", errorMessage);
			return { isOk: false, error: errorMessage };
		}
	}

	/**
	 * Execute podman-compose pull
	 * Pulls the latest images defined in the compose file
	 * @returns { isOk: boolean; output?: string; error?: string }
	 */
	private async runPodmanComposePull(): Promise<{
		isOk: boolean;
		output?: string;
		error?: string;
	}> {
		try {
			const composePath = this.getRuntimeComposePath();

			// If file doesn't exist, we can't pull.
			// Usually this is called after prepareRuntimeCompose, so it should exist.
			if (!fs.existsSync(composePath)) {
				return { isOk: false, error: "Runtime compose file not found." };
			}

			// Execute: podman-compose -f <path> pull
			const result = await this.runCommandWithBroadcast(
				"podman-compose",
				["-f", `"${composePath}"`, "pull"],
				"podman-compose-pull",
			);

			if (!result.isOk) {
				console.error("[Local Vibe] podman-compose pull error:", result.output);
				return { isOk: false, error: result.output };
			}

			console.log("[Local Vibe] podman-compose pull:", result.output);
			return { isOk: true, output: result.output };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("[Local Vibe] podman-compose pull error:", errorMessage);
			return { isOk: false, error: errorMessage };
		}
	}

	/**
	 * Execute podman-compose stop
	 * Stops containers without removing them, allowing fast restart with podman-compose up
	 * Uses runtime compose if exists, falls back to template compose
	 * @returns { isOk: boolean; output?: string; error?: string }
	 */
	private async runPodmanComposeStop(): Promise<{
		isOk: boolean;
		output?: string;
		error?: string;
	}> {
		try {
			// Use runtime compose if exists, otherwise fall back to template
			const runtimePath = this.getRuntimeComposePath();
			const composePath = fs.existsSync(runtimePath) ? runtimePath : this.getDockerComposePath();

			// Execute: podman-compose -f <path> stop
			// Set cwd to runtimeDir so podman-compose can read the .env file
			const result = await this.runCommandWithBroadcast(
				"podman-compose",
				["-f", `"${composePath}"`, "stop"],
				"podman-compose-stop",
				true,
				path.dirname(composePath),
			);

			if (!result.isOk) {
				const errorMessage = result.output;
				// Check if podman-compose command is not found - treat as non-fatal for stop
				if (isCommandNotFound(errorMessage)) {
					console.warn("[Local Vibe] podman-compose stop: podman-compose not found (non-fatal)");
					return { isOk: true, output: "podman-compose not installed, nothing to stop" };
				}

				console.error("[Local Vibe] podman-compose stop error:", errorMessage);
				return { isOk: false, error: errorMessage };
			}

			console.log("[Local Vibe] podman-compose stop:", result.output);
			return { isOk: true, output: result.output };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("[Local Vibe] podman-compose stop error:", errorMessage);
			return { isOk: false, error: errorMessage };
		}
	}

	private async checkCommand(command: string): Promise<{
		isOk: boolean;
		isValid: boolean;
	}> {
		try {
			await execAsync(command);
			return { isOk: true, isValid: true };
		} catch (error) {
			return {
				isOk: !isCommandNotFound(error),
				isValid: false,
			};
		}
	}

	private async runCommandWithBroadcast(
		command: string,
		args: string[],
		step: string,
		useShell = true,
		cwd?: string,
	): Promise<{ isOk: boolean; output: string }> {
		return new Promise((resolve) => {
			let output = "";

			broadcastService.broadcastChannelToAll("install-log", {
				step,
				type: "start",
				data: `Starting: ${step}`,
			});

			const spawnOptions: SpawnOptions = {
				shell: useShell,
				windowsHide: true,
			};
			if (cwd) {
				spawnOptions.cwd = cwd;
			}

			const proc = spawn(command, args, spawnOptions);

			// Helper to process output data (handles \r progress bars)
			const processOutput = (data: Buffer, type: "stdout" | "stderr") => {
				const text = data.toString();
				output += text;
				// Replace \r with \n to ensure progress bars are shown as separate lines
				// Some tools use \r to overwrite the same line for progress animation
				const normalized = text.replace(/\r/g, "\n").replace(/\n+/g, "\n");
				if (normalized.trim()) {
					broadcastService.broadcastChannelToAll("install-log", {
						step,
						type,
						data: normalized,
					});
				}
			};

			proc.stdout?.on("data", (data) => processOutput(data, "stdout"));
			proc.stderr?.on("data", (data) => processOutput(data, "stderr"));

			proc.on("close", (code) => {
				broadcastService.broadcastChannelToAll("install-log", {
					step,
					type: "complete",
					data: `Process exited with code ${code}`,
				});
				resolve({ isOk: code === 0, output });
			});

			proc.on("error", (error) => {
				const errorMsg = error.message;
				output += `\nError: ${errorMsg}`;
				broadcastService.broadcastChannelToAll("install-log", {
					step,
					type: "error",
					data: errorMsg,
				});
				resolve({ isOk: false, output });
			});
		});
	}

	/**
	 * Shows password input dialog via AppleScript
	 */
	private async getSudoPasswordViaAppleScript(step: string): Promise<{
		success: boolean;
		password?: string;
		wasCancelled?: boolean;
		error?: string;
	}> {
		try {
			const title = await this.t("需要管理员权限", "Administrator Password Required");
			const message = await this.t(
				`安装 ${step} 需要管理员权限。请输入您的 macOS 用户密码。`,
				`Installing ${step} requires administrator privileges. Please enter your macOS user password.`,
			);
			const buttonOk = await this.t("确定", "OK");
			const buttonCancel = await this.t("取消", "Cancel");

			// Use heredoc to avoid escaping issues
			const appleScript = `display dialog "${message}" with title "${title}" default answer "" buttons {"${buttonCancel}", "${buttonOk}"} default button "${buttonOk}" with hidden answer`;
			const { stdout, stderr } = await execAsync(`osascript -e '${appleScript}'`);

			// AppleScript might output to stdout or stderr
			const output = stdout || stderr || "";

			// Parse result: "button returned:OK, text returned:password" (AppleScript format)
			// Try multiple patterns to be more robust
			const patterns = [
				/text returned:(.+?)(?:,|$)/m, // text returned:password,
				/text returned:"(.+?)"/m, // text returned:"password"
				/text returned:'(.+?)'/m, // text returned:'password'
				/text returned:(.+)/m, // text returned:password (last resort)
			];

			for (const pattern of patterns) {
				const match = output.match(pattern);
				if (match && match[1]) {
					const password = match[1].trim();
					console.log("[LocalVibeService] Extracted password (length):", password.length);
					return { success: true, password };
				}
			}

			console.error(
				"[LocalVibeService] Failed to parse AppleScript output. stdout:",
				stdout,
				"stderr:",
				stderr,
			);
			return { success: false, error: await this.t("无法获取密码", "Failed to get password") };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("[LocalVibeService] AppleScript error:", errorMessage);

			// User cancelled - check various possible error messages
			if (
				errorMessage.includes("User cancelled") ||
				errorMessage.includes("-128") ||
				errorMessage.includes("cancel")
			) {
				return {
					success: false,
					wasCancelled: true,
					error: await this.t("用户取消", "User cancelled"),
				};
			}

			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Runs command with sudo using AppleScript to get password
	 */
	private async runSudoCommandWithBroadcast(
		command: string,
		args: string[],
		step: string,
	): Promise<{ isOk: boolean; wasCancelled?: boolean }> {
		// Get password
		const passwordResult = await this.getSudoPasswordViaAppleScript(step);

		if (!passwordResult.success) {
			broadcastService.broadcastChannelToAll("install-log", {
				step,
				type: "error",
				data:
					passwordResult.error || (await this.t("用户取消操作", "User cancelled the operation")),
			});
			return { isOk: false, wasCancelled: passwordResult.wasCancelled };
		}

		return new Promise((resolve) => {
			broadcastService.broadcastChannelToAll("install-log", {
				step,
				type: "start",
				data: `Starting: ${step}`,
			});

			// Use sudo -S to read password from stdin and suppress terminal prompt text
			const proc = spawn("sudo", ["-S", "-p", "", command, ...args], {
				shell: false,
				windowsHide: true,
			});

			// Write password
			proc.stdin.write(`${passwordResult.password}\n`);
			proc.stdin.end();

			const processOutput = (data: Buffer, type: "stdout" | "stderr") => {
				const text = data.toString().replace(/\r/g, "\n").replace(/\n+/g, "\n");
				if (text.trim()) {
					broadcastService.broadcastChannelToAll("install-log", { step, type, data: text });
				}
			};

			proc.stdout.on("data", (data) => processOutput(data, "stdout"));
			proc.stderr.on("data", (data) => processOutput(data, "stderr"));

			proc.on("close", (code) => {
				broadcastService.broadcastChannelToAll("install-log", {
					step,
					type: "complete",
					data: `Process exited with code ${code}`,
				});
				resolve({ isOk: code === 0 });
			});

			proc.on("error", (error) => {
				broadcastService.broadcastChannelToAll("install-log", {
					step,
					type: "error",
					data: error.message,
				});
				resolve({ isOk: false });
			});
		});
	}

	/**
	 * Runs privileged command on Linux with a GUI auth prompt when available.
	 * Falls back to non-interactive sudo to avoid terminal password prompts.
	 */
	private async runLinuxPrivilegedCommandWithBroadcast(
		command: string,
		args: string[],
		step: string,
	): Promise<{ isOk: boolean; output: string }> {
		const pkexecCheck = await this.checkCommand("pkexec --version");

		if (pkexecCheck.isValid) {
			const pkexecResult = await this.runCommandWithBroadcast(
				"pkexec",
				[command, ...args],
				step,
				false,
			);

			if (pkexecResult.isOk) {
				return pkexecResult;
			}

			const lowerOutput = pkexecResult.output.toLowerCase();
			if (
				lowerOutput.includes("not authorized") ||
				lowerOutput.includes("authentication failed") ||
				lowerOutput.includes("dismissed") ||
				lowerOutput.includes("no authentication agent found")
			) {
				const errorMessage = await this.t(
					"需要管理员权限，但未完成图形授权。请重试并确认授权弹窗。",
					"Administrator privileges are required, but graphical authorization was not completed. Please retry and confirm the permission prompt.",
				);
				broadcastService.broadcastChannelToAll("install-log", {
					step,
					type: "error",
					data: errorMessage,
				});
				return { isOk: false, output: `${pkexecResult.output}\n${errorMessage}` };
			}

			return pkexecResult;
		}

		const sudoResult = await this.runCommandWithBroadcast(
			"sudo",
			["-n", command, ...args],
			step,
			false,
		);
		if (sudoResult.isOk) {
			return sudoResult;
		}

		const noPromptMessage = await this.t(
			"当前环境无法弹出图形授权窗口。请先在终端执行 `sudo -v` 后重试。",
			"Unable to open a graphical privilege prompt in this environment. Please run `sudo -v` in a terminal, then retry.",
		);
		broadcastService.broadcastChannelToAll("install-log", {
			step,
			type: "error",
			data: noPromptMessage,
		});
		return {
			isOk: false,
			output: `${sudoResult.output}\n${noPromptMessage}`,
		};
	}

	private async checkScoop(): Promise<{
		isOk: boolean;
		isValid: boolean;
	}> {
		return this.checkCommand("scoop --version");
	}

	private async checkWSL(): Promise<{
		isOk: boolean;
		isValid: boolean;
	}> {
		return this.checkCommand("wsl --version");
	}

	/**
	 * Checks the Windows feature state of WSL using DISM
	 * @returns { isOk: boolean; state: 'disabled' | 'enabled' | 'enabled-pending-reboot'; error?: string }
	 */
	private async checkWSLFeatureState(): Promise<{
		isOk: boolean;
		state: "disabled" | "enabled" | "enabled-pending-reboot";
		error?: string;
	}> {
		if (process.platform !== "win32") {
			return { isOk: true, state: "enabled" };
		}

		try {
			const { stdout } = await execAsync(
				"dism /online /get-featureinfo /featurename:Microsoft-Windows-Subsystem-Linux",
			);

			const isEnabled = stdout.includes("State : Enabled") || stdout.includes("状态: 已启用");
			const needsReboot = stdout.includes("Restart Required") || stdout.includes("需要重启");

			if (isEnabled && needsReboot) {
				return { isOk: true, state: "enabled-pending-reboot" };
			} else if (isEnabled) {
				return { isOk: true, state: "enabled" };
			} else {
				return { isOk: true, state: "disabled" };
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.log(
				"[LocalVibeService] DISM check failed (likely permission issue), falling back to WSL status check:",
				errorMessage,
			);

			// DISM requires admin privileges. If it fails, fall back to wsl --status
			// wsl --status will fail if WSL is not enabled/installed
			try {
				const { stdout: statusOutput } = await execAsync("wsl --status");
				// If wsl --status works, WSL is enabled
				console.log("[LocalVibeService] WSL status check succeeded:", statusOutput);
				return { isOk: true, state: "enabled" };
			} catch (statusError) {
				const statusErrorMsg =
					statusError instanceof Error ? statusError.message : String(statusError);
				console.log("[LocalVibeService] WSL status check failed:", statusErrorMsg);

				// wsl --status failed, check if it's because WSL is not enabled
				// Error messages like "The Windows Subsystem for Linux optional component is not enabled"
				if (
					statusErrorMsg.toLowerCase().includes("not enabled") ||
					statusErrorMsg.toLowerCase().includes("not installed") ||
					statusErrorMsg.includes("0xffffffff") ||
					statusErrorMsg.includes("未启用") ||
					statusErrorMsg.includes("未安装")
				) {
					console.log("[LocalVibeService] WSL is not enabled");
					return { isOk: true, state: "disabled" };
				}

				// Check if it's a command not found error
				if (isCommandNotFound(statusError)) {
					console.log("[LocalVibeService] WSL command not found - WSL not installed");
					return { isOk: true, state: "disabled" };
				}

				// For any other error, assume WSL is disabled (safer to attempt enablement)
				console.log("[LocalVibeService] Unknown WSL error, assuming disabled");
				return { isOk: true, state: "disabled" };
			}
		}
	}

	private async checkHomebrew(): Promise<{
		isOk: boolean;
		isValid: boolean;
	}> {
		return this.checkCommand("brew --version");
	}

	/**
	 * Detects the Python user-level Scripts directory.
	 */
	private async detectPythonScriptsPath(): Promise<string | null> {
		if (process.platform !== "win32") return null;
		try {
			const { stdout } = await execAsync("python -m site --user-base");
			const userBase = stdout.trim();
			if (userBase) {
				const scriptsPath = path.join(userBase, "Scripts");
				return fs.existsSync(scriptsPath) ? scriptsPath : null;
			}
		} catch (_e) {
			// Python not available
		}
		return null;
	}

	/**
	 * Refreshes process.env.PATH on Windows by reading the latest user PATH from registry.
	 * Also injects detected Python Scripts to the current process memory.
	 */
	private async refreshWindowsPath(): Promise<void> {
		if (process.platform !== "win32") return;

		try {
			const { stdout: userPathRaw } = await execAsync(
				"powershell.exe -Command \"[Environment]::GetEnvironmentVariable('Path', 'User')\"",
			);
			const userPath = userPathRaw.trim();

			const { stdout: systemPathRaw } = await execAsync(
				"powershell.exe -Command \"[Environment]::GetEnvironmentVariable('Path', 'Machine')\"",
			);
			const systemPath = systemPathRaw.trim();

			let combinedPath = `${userPath};${systemPath}`;

			// Memory injection only: ensure current process can see Python tools
			const scriptsPath = await this.detectPythonScriptsPath();
			if (scriptsPath && !combinedPath.toLowerCase().includes(scriptsPath.toLowerCase())) {
				combinedPath = `${scriptsPath};${combinedPath}`;
			}

			process.env.PATH = combinedPath;
			console.log("[LocalVibeService] Refreshed process PATH (in-memory)");
		} catch (error) {
			console.error("[LocalVibeService] Failed to refresh PATH:", error);
		}
	}

	/**
	 * Wait for Podman to be ready by polling `podman ps` command
	 * This is needed on Windows/WSL where machine startup can take time
	 * @param timeoutMs Maximum time to wait in milliseconds
	 * @returns boolean indicating if Podman is ready
	 */
	private async waitForPodmanReady(timeoutMs: number): Promise<boolean> {
		const startTime = Date.now();
		const pollInterval = 2000; // Check every 2 seconds

		console.log("[Local Vibe] Starting Podman readiness check...");

		while (Date.now() - startTime < timeoutMs) {
			try {
				await execAsync("podman ps");
				console.log("[Local Vibe] Podman is ready");
				return true;
			} catch (error) {
				// Podman not ready yet, log error and wait
				const errorMsg = error instanceof Error ? error.message : String(error);
				console.log("[Local Vibe] Podman not ready yet:", errorMsg.substring(0, 100));

				// Check for WSL connection issues (Windows only)
				if (
					process.platform === "win32" &&
					(errorMsg.includes("Cannot connect to Podman") ||
						errorMsg.includes("verify your connection"))
				) {
					console.log("[Local Vibe] WSL connection issue detected, attempting to fix...");
					// Try to set ai302-machine as default for this session
					try {
						await execAsync("podman system connection default ai302-machine");
						console.log("[Local Vibe] Set ai302-machine as default connection");
					} catch (_error) {
						console.log("[Local Vibe] Failed to set default connection，, will retry...");
					}
				}

				await new Promise((resolve) => setTimeout(resolve, pollInterval));
			}
		}

		console.error(`[Local Vibe] Podman readiness check timed out after ${timeoutMs}ms`);
		return false;
	}

	/**
	 * Checks if podman-compose is installed and accessible
	 * @returns { isOk: boolean; isValid: boolean } - isOk: operation success, isValid: podman-compose is available
	 */
	private async checkPodmanCompose(): Promise<{
		isOk: boolean;
		isValid: boolean;
	}> {
		const basicCheck = await this.checkCommand("podman-compose --version");
		if (basicCheck.isValid) return basicCheck;

		// On Windows, podman-compose (via pip) is often in %APPDATA%\Python\PythonXX\Scripts
		if (process.platform === "win32") {
			const scriptsPath = await this.detectPythonScriptsPath();
			if (scriptsPath) {
				const fullPath = path.join(scriptsPath, "podman-compose.exe");
				if (fs.existsSync(fullPath)) {
					try {
						await execAsync(`"${fullPath}" --version`);
						return { isOk: true, isValid: true };
					} catch (_e) {
						// Not actually valid
					}
				}
			}
		}

		return basicCheck;
	}

	/**
	 * Checks Podman health.
	 * - Linux: checks Podman command availability (rootless mode has no machine)
	 * - macOS/Windows: checks whether ai302-machine exists
	 * @returns { isOk: boolean; isHealth: boolean; timestamp?: number } - isOk: operation success, isHealth: health check result, timestamp when called via startPodmanHealthCheck
	 */
	private async checkPodmanHealth(): Promise<{
		isOk: boolean;
		isHealth: boolean;
	}> {
		// Linux runs Podman in rootless mode (no machine abstraction).
		// Health should be based on podman command availability.
		if (process.platform === "linux") {
			const podmanCheck = await this.checkCommand("podman --version");
			return {
				isOk: podmanCheck.isOk,
				isHealth: podmanCheck.isValid,
			};
		}

		const machineCheck = await this.checkPodmanMachineExists();
		return {
			isOk: machineCheck.isOk,
			isHealth: machineCheck.exists,
		};
	}

	private isExpectedSandboxHealthConnectionError(errorMessage: string): boolean {
		const lowerMsg = errorMessage.toLowerCase();
		return (
			lowerMsg.includes("fetch failed") ||
			lowerMsg.includes("failed to fetch") ||
			lowerMsg.includes("econnrefused") ||
			lowerMsg.includes("connection refused") ||
			lowerMsg.includes("socket hang up") ||
			lowerMsg.includes("network error") ||
			lowerMsg.includes("etimedout") ||
			lowerMsg.includes("timed out")
		);
	}

	private async checkLocalSandboxHealth(): Promise<{
		isOk: boolean;
		isHealth: boolean;
		isOcHealth: boolean;
		error?: string;
	}> {
		try {
			const response = await getLocalSandboxHealthStatus();
			return {
				isOk: true,
				isHealth: response.status === "ok",
				isOcHealth: response.oc_status === "ok",
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			// Suppress error logging if operating (starting/stopping) or if it's a connection error
			// unexpected errors should still be logged
			if (!this.isOperating && !this.isExpectedSandboxHealthConnectionError(errorMessage)) {
				console.error("[LocalVibeService] Local sandbox health check failed:", errorMessage);
			}
			return { isOk: true, isHealth: false, isOcHealth: false, error: errorMessage };
		}
	}

	/**
	 * Checks if the ai302-machine exists in podman machine list
	 * Also checks WSL distributions on Windows as fallback (for state inconsistency cases)
	 * @returns { isOk: boolean; exists: boolean; existsInWSL?: boolean } - isOk: operation success, exists: whether machine exists in podman, existsInWSL: whether machine exists in WSL (Windows only)
	 */
	private async checkPodmanMachineExists(): Promise<{
		isOk: boolean;
		exists: boolean;
		existsInWSL?: boolean;
	}> {
		try {
			const { stdout } = await execAsync("podman machine list --format json");
			const machines = JSON.parse(stdout) as Array<{
				Name: string;
				Running?: boolean;
				State?: string;
			}>;
			const exists = machines.some((machine) => machine.Name === "ai302-machine");

			return { isOk: true, exists };
		} catch (error) {
			if (isCommandNotFound(error)) {
				return { isOk: true, exists: false };
			}
			return { isOk: false, exists: false };
		}
	}

	/**
	 * Validates local Podman environment.
	 * - Linux: podman + podman-compose are required
	 * - macOS/Windows: podman + ai302-machine + podman-compose are required
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean; isValid: boolean; output?: string; error?: string; details?: { podmanInstalled: boolean; machineExists: boolean; composeInstalled: boolean } } - isOk: operation success, isValid: platform-specific validation result, output: command output, error: error message if failed, details: detailed component status
	 */
	async validPodman(_event: IpcMainInvokeEvent): Promise<{
		isOk: boolean;
		isValid: boolean;
		output?: string;
		error?: string;
		details?: { podmanInstalled: boolean; machineExists: boolean; composeInstalled: boolean };
	}> {
		try {
			const { stdout, stderr } = await execAsync("podman --version");
			const podmanInstalled = stdout.toLowerCase().includes("podman version");

			if (!podmanInstalled) {
				return {
					isOk: true,
					isValid: false,
					output: `${stdout}\n${stderr}`,
					details: { podmanInstalled: false, machineExists: false, composeInstalled: false },
				};
			}

			const isLinux = process.platform === "linux";

			// Linux rootless mode doesn't require ai302-machine.
			let machineExists = true;
			if (!isLinux) {
				const machineCheck = await this.checkPodmanMachineExists();
				if (!machineCheck.isOk) {
					return {
						isOk: false,
						isValid: false,
						error: "Failed to check machine list",
						details: { podmanInstalled: true, machineExists: false, composeInstalled: false },
					};
				}
				machineExists = machineCheck.exists;
			}

			// Check if podman-compose is available
			const composeCheck = await this.checkPodmanCompose();
			if (!composeCheck.isOk) {
				return {
					isOk: false,
					isValid: false,
					error: "Failed to check podman-compose",
					details: {
						podmanInstalled: true,
						machineExists,
						composeInstalled: false,
					},
				};
			}

			const details = {
				podmanInstalled: true,
				machineExists,
				composeInstalled: composeCheck.isValid,
			};

			if (!composeCheck.isValid) {
				const composeError = await this.t(
					"podman-compose 未安装。请先安装 podman-compose。",
					"podman-compose is not installed. Please install podman-compose first.",
				);
				return { isOk: true, isValid: false, error: composeError, details };
			}

			const isValid = isLinux ? true : machineExists;
			return { isOk: true, isValid, output: stdout, details };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			if (isCommandNotFound(error)) {
				return {
					isOk: true,
					isValid: false,
					error: errorMessage,
					details: { podmanInstalled: false, machineExists: false, composeInstalled: false },
				};
			}

			return { isOk: false, isValid: false, error: errorMessage };
		}
	}

	/**
	 * Starts the periodic Podman health check (every 30 seconds)
	 * Results are broadcast to all renderer processes via "podman-health" channel
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean } - isOk: operation success
	 */
	async startPodmanHealthCheck(_event: IpcMainInvokeEvent): Promise<{ isOk: boolean }> {
		const taskName = "podman-health-check";
		const podmanHealthCheckJob = async () => {
			const result = await this.checkPodmanHealth();
			const healthData = {
				...result,
				timestamp: Date.now(),
			};
			broadcastService.broadcastChannelToAll(taskName, healthData);
		};

		try {
			if (schedulerService.hasTask(taskName)) {
				schedulerService.removeTask(taskName);
			}

			const success = schedulerService.addTask(
				taskName,
				CRON_EXPRESSION.EVERY_10_SECONDS,
				podmanHealthCheckJob,
			);

			if (!success) {
				return { isOk: false };
			}

			// Run initial check immediately
			const initialResult = await this.checkPodmanHealth();
			broadcastService.broadcastChannelToAll(taskName, {
				...initialResult,
				timestamp: Date.now(),
			});

			return { isOk: true };
		} catch (error) {
			console.error("[LocalVibeService] Failed to start Podman health check:", error);
			return { isOk: false };
		}
	}

	/**
	 * Starts the periodic Local Sandbox health check (every 30 seconds)
	 * Results are broadcast to all renderer processes via "local-sandbox-health-check" channel
	 */
	async startLocalSandboxHealthCheck(): Promise<{ isOk: boolean }> {
		const taskName = "local-sandbox-health-check";
		const localSandboxHealthCheckJob = async () => {
			const result = await this.checkLocalSandboxHealth();
			const healthData = {
				...result,
				timestamp: Date.now(),
			};
			broadcastService.broadcastChannelToAll(taskName, healthData);
		};

		try {
			if (schedulerService.hasTask(taskName)) {
				schedulerService.removeTask(taskName);
			}

			const success = schedulerService.addTask(
				taskName,
				CRON_EXPRESSION.EVERY_10_SECONDS,
				localSandboxHealthCheckJob,
			);

			if (!success) {
				return { isOk: false };
			}

			// Run initial check immediately
			const initialResult = await this.checkLocalSandboxHealth();
			broadcastService.broadcastChannelToAll(taskName, {
				...initialResult,
				timestamp: Date.now(),
			});

			return { isOk: true };
		} catch (error) {
			console.error("[LocalVibeService] Failed to start Local Sandbox health check:", error);
			return { isOk: false };
		}
	}

	/**
	 * Stops the periodic Local Sandbox health check
	 */
	async stopLocalSandboxHealthCheck(): Promise<{ isOk: boolean }> {
		const taskName = "local-sandbox-health-check";
		try {
			if (schedulerService.hasTask(taskName)) {
				schedulerService.removeTask(taskName);
			}
			return { isOk: true };
		} catch (error) {
			console.error("[LocalVibeService] Failed to stop Local Sandbox health check:", error);
			return { isOk: false };
		}
	}

	/**
	 * Installs WSL2 on Windows
	 *
	 * Broadcasts log events via "install-log" channel with the following format:
	 * - Start:  { step: "wsl", type: "start", data: "Starting: wsl" }
	 * - Stdout: { step: "wsl", type: "stdout", data: "Installing: Windows Subsystem for Linux..." }
	 * - Stderr: { step: "wsl", type: "stderr", data: "..." }
	 * - Complete: { step: "wsl", type: "complete", data: "Process exited with code 0" }
	 * - Error:  { step: "wsl", type: "error", data: "Error message" }
	 *
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean } - isOk: operation success
	 */
	async installWSL(_event: IpcMainInvokeEvent): Promise<{ isOk: boolean }> {
		const result = await this.runCommandWithBroadcast("wsl", ["--install"], "wsl");
		return result;
	}

	/**
	 * Installs Scoop on Windows
	 *
	 * Broadcasts log events via "install-log" channel for two steps:
	 * - scoop-policy: Sets execution policy for PowerShell
	 * - scoop-install: Downloads and installs Scoop
	 *
	 * Log event examples:
	 * - Start:  { step: "scoop-policy", type: "start", data: "Starting: scoop-policy" }
	 * - Stdout: { step: "scoop-policy", type: "stdout", data: "..." }
	 * - Complete: { step: "scoop-policy", type: "complete", data: "Process exited with code 0" }
	 * - Start:  { step: "scoop-install", type: "start", data: "Starting: scoop-install" }
	 * - Stdout: { step: "scoop-install", type: "stdout", data: "Initializing..." }
	 * - Complete: { step: "scoop-install", type: "complete", data: "Process exited with code 0" }
	 *
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean } - isOk: operation success
	 */
	async installScoop(_event: IpcMainInvokeEvent): Promise<{ isOk: boolean }> {
		const scoopInstall = await this.runCommandWithBroadcast(
			"powershell.exe",
			[
				"-ExecutionPolicy",
				"Bypass",
				"-Command",
				"Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression",
			],
			"scoop-install",
			false,
		);

		return scoopInstall;
	}

	/**
	 * Installs Homebrew on macOS
	 *
	 * Broadcasts log events via "install-log" channel with the following format:
	 * - Start:  { step: "homebrew", type: "start", data: "Starting: homebrew" }
	 * - Stdout: { step: "homebrew", type: "stdout", data: "==> Checking for sudo access..." }
	 * - Stdout: { step: "homebrew", type: "stdout", data: "==> Downloading and installing Homebrew..." }
	 * - Stderr: { step: "homebrew", type: "stderr", data: "..." }
	 * - Complete: { step: "homebrew", type: "complete", data: "Process exited with code 0" }
	 * - Error:  { step: "homebrew", type: "error", data: "Error message" }
	 *
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean } - isOk: operation success
	 */
	async installHomebrew(_event: IpcMainInvokeEvent): Promise<{ isOk: boolean }> {
		// Pre-authorize sudo via app-level prompt so installer doesn't block on terminal password input.
		const sudoAuth = await this.runSudoCommandWithBroadcast("true", [], "homebrew-auth");
		if (!sudoAuth.isOk) {
			return { isOk: false };
		}

		const result = await this.runCommandWithBroadcast(
			"/bin/bash",
			[
				"-c",
				'sudo -n -v && NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
			],
			"homebrew",
		);
		return result;
	}

	/**
	 * Persists a path to the Windows User Environment PATH variable.
	 */
	private async persistPathToUserRegistry(pathToAdd: string): Promise<void> {
		if (process.platform !== "win32") return;
		try {
			const psCommand = `
				$target = "${pathToAdd}";
				$oldPath = [Environment]::GetEnvironmentVariable("Path", "User");
				if ($oldPath -split ";" -notcontains $target) {
					$newPath = if ([string]::IsNullOrWhiteSpace($oldPath)) { $target } else { "$oldPath;$target" };
					[Environment]::SetEnvironmentVariable("Path", $newPath, "User");
				}
			`;
			await execAsync(`powershell.exe -Command "${psCommand.replace(/\n/g, " ")}"`);
		} catch (error) {
			console.error("[LocalVibeService] Failed to persist path:", error);
		}
	}

	/**
	 * Installs podman-compose on the current platform
	 *
	 * Platform-specific installation:
	 * - Windows: pip install podman-compose
	 * - macOS: brew install podman-compose
	 * - Linux: pip3 install podman-compose or apt-get install podman-compose
	 *
	 * Broadcasts log events via "install-log" channel with step: "install-podman-compose"
	 *
	 * @returns { isOk: boolean } - isOk: operation success
	 */
	private async installPodmanCompose(): Promise<{ isOk: boolean }> {
		const platform = process.platform;

		if (platform === "win32") {
			// Windows: Install via pip (install python via scoop first if pip is not available)
			const pipCheck = await this.checkCommand("pip --version");
			if (!pipCheck.isValid) {
				const pythonInstall = await this.runCommandWithBroadcast(
					"scoop",
					["install", "python"],
					"install-python",
				);
				if (!pythonInstall.isOk) return { isOk: false };

				// Refresh PATH so pip is available in this process
				await this.refreshWindowsPath();
			}
			const result = await this.runCommandWithBroadcast(
				"pip",
				["install", "podman-compose"],
				"install-podman-compose",
			);
			if (result.isOk) {
				const scriptsPath = await this.detectPythonScriptsPath();
				if (scriptsPath) {
					await this.persistPathToUserRegistry(scriptsPath);
					console.log("[LocalVibeService] Persisted Python Scripts to registry after install");
				}
				await this.refreshWindowsPath();
			}
			return result;
		} else if (platform === "darwin") {
			// macOS: Install via Homebrew
			return this.runCommandWithBroadcast(
				"brew",
				["install", "podman-compose"],
				"install-podman-compose",
			);
		} else if (platform === "linux") {
			// Linux: Try pip first, fallback to apt-get
			const pipResult = await this.runCommandWithBroadcast(
				"pip3",
				["install", "podman-compose"],
				"install-podman-compose",
			);
			if (pipResult.isOk) {
				return pipResult;
			}
			// Fallback to apt-get
			return this.runLinuxPrivilegedCommandWithBroadcast(
				"apt-get",
				["install", "-y", "podman-compose"],
				"install-podman-compose",
			);
		}

		return { isOk: false };
	}

	/**
	 * Checks if an error is network-related
	 * @param errorMessage The error message to check
	 * @returns Object indicating error type and user-friendly messages
	 */
	private classifyNetworkError(errorMessage: string): {
		isNetworkError: boolean;
		errorType: "dns" | "timeout" | "connection_refused" | "proxy" | "unknown";
		zhMessage: string;
		enMessage: string;
	} {
		const lowerMsg = errorMessage.toLowerCase();

		// DNS resolution errors
		if (
			lowerMsg.includes("no such host") ||
			lowerMsg.includes("lookup") ||
			lowerMsg.includes("resolve") ||
			lowerMsg.includes("nxdomain")
		) {
			return {
				isNetworkError: true,
				errorType: "dns",
				zhMessage: "无法解析容器镜像仓库地址，请检查网络连接和 DNS 设置",
				enMessage:
					"Cannot resolve container registry address. Please check your network connection and DNS settings.",
			};
		}

		// Connection timeout
		if (
			lowerMsg.includes("timeout") ||
			lowerMsg.includes("timed out") ||
			lowerMsg.includes("deadline exceeded")
		) {
			return {
				isNetworkError: true,
				errorType: "timeout",
				zhMessage: "连接容器镜像仓库超时，请检查网络连接或稍后重试",
				enMessage:
					"Connection to container registry timed out. Please check your network or try again later.",
			};
		}

		// Connection refused
		if (lowerMsg.includes("connection refused") || lowerMsg.includes("refused")) {
			return {
				isNetworkError: true,
				errorType: "connection_refused",
				zhMessage: "连接被拒绝，可能是防火墙或代理设置问题",
				enMessage: "Connection refused. This may be due to firewall or proxy settings.",
			};
		}

		// Proxy errors
		if (lowerMsg.includes("proxy") || lowerMsg.includes("tunnel")) {
			return {
				isNetworkError: true,
				errorType: "proxy",
				zhMessage: "代理服务器错误，请检查代理设置",
				enMessage: "Proxy server error. Please check your proxy settings.",
			};
		}

		return {
			isNetworkError: false,
			errorType: "unknown",
			zhMessage: "",
			enMessage: "",
		};
	}

	/**
	 * Initialize Podman machine with retry logic for network errors
	 */
	private async _initPodmanMachineWithRetry(
		maxRetries = 3,
	): Promise<{ isOk: boolean; output?: string }> {
		let lastError = "";

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			// Log retry attempt (if not first attempt)
			if (attempt > 1) {
				const retryMsg = await this.t(
					`第 ${attempt}/${maxRetries} 次尝试初始化 Podman...`,
					`Attempt ${attempt}/${maxRetries} to initialize Podman...`,
				);
				broadcastService.broadcastChannelToAll("install-log", {
					step: "init-podman",
					type: "stdout",
					data: retryMsg,
				});

				// Exponential backoff: wait 2^attempt seconds (2, 4, 8 seconds)
				const delayMs = Math.pow(2, attempt - 1) * 1000;
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}

			const initArgs = [
				"machine",
				"init",
				"--cpus",
				"4",
				"--memory",
				"4096",
				...(PLATFORM.IS_WINDOWS ? ["--rootful"] : []),
				"ai302-machine",
			];
			const result = await this.runCommandWithBroadcast("podman", initArgs, "init-podman");

			if (result.isOk) {
				return { isOk: true, output: result.output };
			}

			lastError = result.output || "";

			// Check if this is a network error
			const networkError = this.classifyNetworkError(lastError);

			if (networkError.isNetworkError) {
				// Log the specific network error
				broadcastService.broadcastChannelToAll("install-log", {
					step: "init-podman",
					type: "stderr",
					data: networkError.enMessage,
				});

				// If it's the last attempt, fail with the specific message
				if (attempt === maxRetries) {
					const language = await generalSettingsService.getLanguage();
					const finalError = language === "zh" ? networkError.zhMessage : networkError.enMessage;
					broadcastService.broadcastChannelToAll("install-log", {
						step: "init-podman",
						type: "error",
						data: finalError,
					});
					return { isOk: false, output: lastError };
				}

				// Otherwise, continue to next retry
				continue;
			}

			// Not a network error, return the result as-is
			return { isOk: false, output: lastError };
		}

		return { isOk: false, output: lastError };
	}

	/**
	 * Initializes the ai302-machine if it doesn't already exist
	 * Checks for existing machine before attempting init
	 * Handles orphaned WSL distributions by cleaning them up first
	 * @returns { isOk: boolean } - isOk: operation success
	 */
	private async _initPodmanMachine(): Promise<{ isOk: boolean }> {
		// Check if machine already exists
		const machineCheck = await this.checkPodmanMachineExists();
		if (!machineCheck.isOk) {
			return { isOk: false };
		}

		// Machine already exists in Podman, skip init
		if (machineCheck.exists) {
			broadcastService.broadcastChannelToAll("install-log", {
				step: "init-podman",
				type: "stdout",
				data: "Machine 'ai302-machine' already exists, skipping initialization",
			});
			return { isOk: true };
		}

		// Clean up stale machine and system connections before init
		// This handles the case where a previous install left orphaned state
		try {
			await execAsync("podman machine stop ai302-machine");

			console.log("[LocalVibeService] Cleaned up stale machine/connections for 'ai302-machine'");
			broadcastService.broadcastChannelToAll("install-log", {
				step: "init-podman",
				type: "stdout",
				data: "Cleaned up stale ai302-machine configuration",
			});
		} catch {
			// Cleanup errors are non-fatal
		}

		// Initialize Podman Machine with retry logic
		const machineInit = await this._initPodmanMachineWithRetry(3);

		return machineInit;
	}

	/**
	 * Installs Podman with platform-specific logic
	 *
	 * Platform flows:
	 * - Windows: Check/install WSL → Check/install Scoop → Install Podman (if needed) → Install podman-compose (if needed) → Init machine with WSL provider
	 * - macOS: Check/install Homebrew → Install Podman (if needed) → Install podman-compose (if needed) → Init machine
	 * - Linux: Install Podman via apt-get (if needed) → Install podman-compose (if needed)
	 *
	 * If Podman is already installed but ai302-machine doesn't exist, only machine init will be performed.
	 *
	 * Broadcasts log events via "install-log" channel with step identifiers:
	 * - install-wsl, scoop-policy, scoop-install, install-homebrew, install-podman, install-podman-compose, init-podman
	 *
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean } - isOk: operation success
	 */
	async installPodman(_event: IpcMainInvokeEvent): Promise<{ isOk: boolean }> {
		const platform = process.platform;

		const result = await match(platform)
			.with("win32", () => this._installPodmanWindows())
			.with("darwin", () => this._installPodmanMacOS())
			.with("linux", () => this._installPodmanLinux())
			.otherwise(() => {
				console.error(`[LocalVibeService] Unsupported platform: ${platform}`);
				return { isOk: false };
			});

		// Start health check after successful installation
		if (result.isOk) {
			await this.startPodmanHealthCheck(_event);
		}

		return result;
	}

	/**
	 * Initialize Podman machine only (without installing prerequisites).
	 * Used on Windows where users manually install WSL, Scoop, Podman, and podman-compose,
	 * and only need the app to handle `podman machine init ai302-machine`.
	 */
	async initPodmanMachine(_event: IpcMainInvokeEvent): Promise<{ isOk: boolean }> {
		const result = await this._initPodmanMachine();

		if (result.isOk) {
			await this.startPodmanHealthCheck(_event);
		}

		return result;
	}

	/**
	 * Windows installation flow:
	 * 1. Check/install WSL
	 * 2. Check/install Scoop
	 * 3. Install Podman (if not already installed)
	 * 4. Install podman-compose (if not already installed)
	 * 5. Initialize Podman Machine with WSL provider (if not already exists)
	 */
	private async _installPodmanWindows(): Promise<{ isOk: boolean }> {
		// Check if Podman is already installed and machine exists
		const podmanCheck = await this.checkCommand("podman --version");
		const machineCheck = await this.checkPodmanMachineExists();
		const composeCheck = await this.checkPodmanCompose();

		if (podmanCheck.isValid && machineCheck.exists && composeCheck.isValid) {
			// Podman, machine and podman-compose exist, nothing to do
			broadcastService.broadcastChannelToAll("install-log", {
				step: "init-podman",
				type: "stdout",
				data: "Podman, ai302-machine and podman-compose already exist, skipping installation",
			});
			return { isOk: true };
		}

		// 1. Tip: recommend updating WSL (requires admin, so we just inform the user)
		const wslTip = await this.t(
			"提示：如果您稍后遇到 Podman 启动问题，请尝试在管理员终端中运行 'wsl --update' 来更新 WSL。",
			"Tip: If you encounter issues starting Podman later, please ensure WSL is up-to-date by running 'wsl --update' in an Administrator terminal.",
		);
		broadcastService.broadcastChannelToAll("install-log", {
			step: "tip",
			type: "stdout",
			data: wslTip,
		});

		// 2. Check and install Scoop
		const scoopCheck = await this.checkScoop();
		if (!scoopCheck.isValid) {
			// Install Scoop with execution policy bypass (shell: false to avoid cmd.exe pipe interception)
			const scoopInstall = await this.runCommandWithBroadcast(
				"powershell.exe",
				[
					"-ExecutionPolicy",
					"Bypass",
					"-Command",
					"Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression",
				],
				"scoop-install",
				false,
			);
			if (!scoopInstall.isOk) return { isOk: false };

			// Refresh PATH so scoop commands are available in this process
			await this.refreshWindowsPath();
		}

		// 3. Install Podman (only if not already installed)
		if (!podmanCheck.isValid) {
			const maxRetries = 3;
			let podmanInstalled = false;

			for (let attempt = 1; attempt <= maxRetries; attempt++) {
				if (attempt > 1) {
					broadcastService.broadcastChannelToAll("install-log", {
						step: "install-podman",
						type: "stdout",
						data: `Retrying Podman installation (attempt ${attempt}/${maxRetries})...`,
					});
					// Clean up failed install before retry
					try {
						await execAsync("scoop uninstall podman");
					} catch {
						// May not exist, that's fine
					}
				}

				await this.runCommandWithBroadcast("scoop", ["install", "podman@5.7.0"], "install-podman");

				// Refresh PATH so podman command is available in this process
				await this.refreshWindowsPath();

				// Verify podman was actually installed (scoop can return exit code 0 even if download failed)
				const podmanVerify = await this.checkCommand("podman --version");
				if (podmanVerify.isValid) {
					podmanInstalled = true;
					break;
				}

				broadcastService.broadcastChannelToAll("install-log", {
					step: "install-podman",
					type: "stderr",
					data: `Podman installation verification failed (attempt ${attempt}/${maxRetries})`,
				});
			}

			if (!podmanInstalled) {
				broadcastService.broadcastChannelToAll("install-log", {
					step: "install-podman",
					type: "error",
					data: "Podman installation failed after 3 attempts. Please check your network and try again.",
				});
				return { isOk: false };
			}
		} else {
			broadcastService.broadcastChannelToAll("install-log", {
				step: "install-podman",
				type: "stdout",
				data: "Podman already installed, skipping installation",
			});
		}

		// 4. Install podman-compose (only if not already installed)
		if (!composeCheck.isValid) {
			const composeInstall = await this.installPodmanCompose();
			if (!composeInstall.isOk) return { isOk: false };
		} else {
			broadcastService.broadcastChannelToAll("install-log", {
				step: "install-podman-compose",
				type: "stdout",
				data: "podman-compose already installed, skipping installation",
			});
		}

		// 5. Initialize Podman Machine (only if not already exists)
		return this._initPodmanMachine();
	}

	/**
	 * macOS installation flow:
	 * 1. Check/install Homebrew
	 * 2. Install Podman via Homebrew (if not already installed)
	 * 3. Install podman-compose (if not already installed)
	 * 4. Initialize Podman machine (if not already exists)
	 */
	private async _installPodmanMacOS(): Promise<{ isOk: boolean }> {
		// Check if Podman is already installed and machine exists
		const podmanCheck = await this.checkCommand("podman --version");
		const machineCheck = await this.checkPodmanMachineExists();
		const composeCheck = await this.checkPodmanCompose();

		if (podmanCheck.isValid && machineCheck.exists && composeCheck.isValid) {
			// Podman, machine and podman-compose exist, nothing to do
			broadcastService.broadcastChannelToAll("install-log", {
				step: "init-podman",
				type: "stdout",
				data: "Podman, ai302-machine and podman-compose already exist, skipping installation",
			});
			return { isOk: true };
		}

		// 1. Check and install Homebrew
		const brewCheck = await this.checkHomebrew();
		if (!brewCheck.isValid) {
			const sudoAuth = await this.runSudoCommandWithBroadcast("true", [], "install-homebrew-auth");
			if (!sudoAuth.isOk) return { isOk: false };

			const brewInstall = await this.runCommandWithBroadcast(
				"/bin/bash",
				[
					"-c",
					'sudo -n -v && NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
				],
				"install-homebrew",
			);
			if (!brewInstall.isOk) return { isOk: false };
		}

		// 2. Install Podman (only if not already installed)
		if (!podmanCheck.isValid) {
			const podmanInstall = await this.runCommandWithBroadcast(
				"brew",
				["install", "podman"],
				"install-podman",
			);
			if (!podmanInstall.isOk) return { isOk: false };
		} else {
			broadcastService.broadcastChannelToAll("install-log", {
				step: "install-podman",
				type: "stdout",
				data: "Podman already installed, skipping installation",
			});
		}

		// 3. Install podman-compose (only if not already installed)
		if (!composeCheck.isValid) {
			const composeInstall = await this.installPodmanCompose();
			if (!composeInstall.isOk) return { isOk: false };
		} else {
			broadcastService.broadcastChannelToAll("install-log", {
				step: "install-podman-compose",
				type: "stdout",
				data: "podman-compose already installed, skipping installation",
			});
		}

		// 4. Initialize Podman Machine (only if not already exists)
		const machineInit = await this._initPodmanMachine();
		if (!machineInit.isOk) return { isOk: false };

		// 5. Install podman-mac-helper for better performance
		const helperInstall = await this.runSudoCommandWithBroadcast(
			"/opt/homebrew/Cellar/podman/5.7.1/bin/podman-mac-helper",
			["install"],
			"install-podman-mac-helper",
		);

		if (helperInstall.wasCancelled) {
			broadcastService.broadcastChannelToAll("install-log", {
				step: "install-podman-mac-helper",
				type: "stdout",
				data: await this.t(
					"用户跳过了 podman-mac-helper 安装",
					"User skipped podman-mac-helper installation",
				),
			});
			return { isOk: true };
		}

		if (!helperInstall.isOk) return { isOk: false };

		return machineInit;
	}

	/**
	 * Linux installation flow (Ubuntu/Debian):
	 * 1. Install Podman via apt-get (if not already installed)
	 * 2. Install podman-compose (if not already installed)
	 */
	private async _installPodmanLinux(): Promise<{ isOk: boolean }> {
		// Check if Podman is already installed
		const podmanCheck = await this.checkCommand("podman --version");
		const composeCheck = await this.checkPodmanCompose();

		if (podmanCheck.isValid && composeCheck.isValid) {
			broadcastService.broadcastChannelToAll("install-log", {
				step: "install-podman",
				type: "stdout",
				data: "Podman and podman-compose already installed, skipping installation",
			});
			return { isOk: true };
		}

		// 1. Install Podman (only if not already installed)
		if (!podmanCheck.isValid) {
			const podmanInstall = await this.runLinuxPrivilegedCommandWithBroadcast(
				"apt-get",
				["-y", "install", "podman"],
				"install-podman",
			);
			if (!podmanInstall.isOk) return { isOk: false };
		} else {
			broadcastService.broadcastChannelToAll("install-log", {
				step: "install-podman",
				type: "stdout",
				data: "Podman already installed, skipping installation",
			});
		}

		// 2. Install podman-compose (only if not already installed)
		if (!composeCheck.isValid) {
			const composeInstall = await this.installPodmanCompose();
			if (!composeInstall.isOk) return { isOk: false };
		} else {
			broadcastService.broadcastChannelToAll("install-log", {
				step: "install-podman-compose",
				type: "stdout",
				data: "podman-compose already installed, skipping installation",
			});
		}

		return { isOk: true };
	}

	/**
	 * Private method to stop the local sandbox Podman machine
	 * First runs podman compose stop to stop containers (without removing them)
	 * Then stops the Podman machine (macOS/Windows only - Linux runs rootless)
	 * Executes `podman machine stop ai302-machine`
	 * - Machine not existing or already stopped counts as success
	 * - Command not found or other errors count as failure
	 * On success, broadcasts non-healthy status via "podman-health" channel
	 */
	private async _stopLocalSandbox(): Promise<{ isOk: boolean; output?: string; error?: string }> {
		// If another operation is already in progress, don't start a new one.
		// For stop operations, if it's already stopping or operating, we can treat it as success
		// or at least avoid redundant/conflicting commands.
		if (this.isOperating) {
			console.log("[Local Vibe] Operation already in progress, skipping redundant stop request");
			return { isOk: true, output: "Stop already in progress" };
		}

		const platform = process.platform;
		this.isOperating = true;

		try {
			// Stop local sandbox health check
			await this.stopLocalSandboxHealthCheck();

			// First, stop podman compose services (keeps containers for fast restart)
			const composeResult = await this.runPodmanComposeStop();
			if (composeResult.output) {
				console.log(
					"[Local Vibe] podman compose stop before stopping machine:",
					composeResult.output,
				);
			}
			if (composeResult.error) {
				console.error("[Local Vibe] podman compose stop error (non-fatal):", composeResult.error);
			}

			// On Linux, Podman runs rootless without a VM - skip machine stop
			if (platform === "linux") {
				console.log("[Local Vibe] Linux detected, skipping machine stop (rootless mode)");

				// Broadcast non-healthy status
				broadcastService.broadcastChannelToAll("podman-health", {
					isOk: true,
					isHealth: false,
					timestamp: Date.now(),
				});

				return { isOk: true, output: "Linux rootless mode - no machine to stop" };
			}

			// macOS/Windows: Stop the Podman machine
			const { stdout, stderr } = await execAsync("podman machine stop ai302-machine");

			// Broadcast non-healthy status after successful stop
			broadcastService.broadcastChannelToAll("podman-health", {
				isOk: true,
				isHealth: false,
				timestamp: Date.now(),
			});

			return { isOk: true, output: `${stdout}\n${stderr}` };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorMessageLower = errorMessage.toLowerCase();

			// Command not found - Podman is not installed
			if (isCommandNotFound(error)) {
				return { isOk: false, error: errorMessage };
			}

			// Machine does not exist - counts as success (nothing to stop)
			if (errorMessageLower.includes("does not exist")) {
				return { isOk: true, output: errorMessage };
			}

			// Machine already stopped - counts as success
			if (errorMessageLower.includes("is not running")) {
				return { isOk: true, output: errorMessage };
			}

			// Other errors - counts as failure
			return { isOk: false, error: errorMessage };
		} finally {
			this.isOperating = false;
		}
	}

	/**
	 * IPC method to stop the local sandbox
	 * Called from renderer process
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean; output?: string; error?: string } - isOk: operation success, output: command output, error: error message if failed
	 */
	async stopLocalSandboxByIpc(
		_event: IpcMainInvokeEvent,
	): Promise<{ isOk: boolean; output?: string; error?: string }> {
		return this._stopLocalSandbox();
	}

	/**
	 * Public method to stop the local sandbox
	 * Used by client (main process) before closing
	 * @returns { isOk: boolean; output?: string; error?: string } - isOk: operation success, output: command output, error: error message if failed
	 */
	async stopLocalSandbox(): Promise<{ isOk: boolean; output?: string; error?: string }> {
		return this._stopLocalSandbox();
	}

	/**
	 * Force-stop Podman compose services and machine.
	 * Designed for the update-restart path where:
	 * - The `isOperating` guard must NOT block the call (update happens anytime).
	 * - Broadcasting is pointless (windows are about to close).
	 * - Health-check timers don't need explicit cleanup (process is exiting).
	 *
	 * Each step has its own try-catch so a compose-stop failure won't prevent
	 * the machine from being stopped.
	 */
	async forceStopPodman(): Promise<void> {
		// 1. Stop compose services
		try {
			const runtimePath = this.getRuntimeComposePath();
			const composePath = fs.existsSync(runtimePath) ? runtimePath : this.getDockerComposePath();
			await execAsync(`podman-compose -f "${composePath}" stop`);
		} catch (e) {
			console.error("[Local Vibe] forceStopPodman compose stop error:", e);
		}

		// 2. Stop machine (Linux runs rootless — no VM to stop)
		if (process.platform !== "linux") {
			try {
				await execAsync("podman machine stop ai302-machine");
			} catch (e) {
				console.error("[Local Vibe] forceStopPodman machine stop error:", e);
			}
		}
	}

	/**
	 * Ensures the local sandbox is running, starting it if necessary
	 * This is an idempotent operation - safe to call multiple times
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean; port?: number; openClawPort?: number; error?: string; wasAlreadyRunning: boolean }
	 */
	async ensureLocalSandboxRunning(_event: IpcMainInvokeEvent): Promise<{
		isOk: boolean;
		port?: number;
		openClawPort?: number;
		error?: string;
		wasAlreadyRunning: boolean;
	}> {
		try {
			// First check if local sandbox is already healthy
			const healthCheck = await this.checkLocalSandboxHealth();

			if (healthCheck.isHealth) {
				// Sandbox is already running
				const port = this.getRuntimePort() ?? DEFAULT_SANDBOX_PORT;
				const openClawPort = this.getRuntimeOpenClawPort() ?? DEFAULT_OPENCLAW_PORT;
				console.log("[Local Vibe] Local sandbox already running on port:", port);
				return { isOk: true, port, openClawPort, wasAlreadyRunning: true };
			}

			// Sandbox is not running, start it
			console.log("[Local Vibe] Local sandbox not running, starting...");
			const startResult = await this.startPodmanMachine(_event);

			if (!startResult.isOk) {
				return {
					isOk: false,
					error: startResult.error,
					wasAlreadyRunning: false,
				};
			}

			return {
				isOk: true,
				port: startResult.port,
				openClawPort: startResult.openClawPort,
				wasAlreadyRunning: startResult.alreadyStarted ?? false,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("[Local Vibe] Failed to ensure local sandbox running:", errorMessage);
			return { isOk: false, error: errorMessage, wasAlreadyRunning: false };
		}
	}

	/**
	 * Starts the ai302-machine Podman machine (macOS/Windows only)
	 * On Linux, Podman runs rootless without a VM, so machine start is skipped
	 * Executes `podman machine start ai302-machine`
	 * Checks output for success message or already started state
	 * After successful start, automatically runs podman compose up -d
	 * @param _event The IPC main invoke event
	 * @returns { isOk: boolean; alreadyStarted?: boolean; port?: number; openClawPort?: number; output?: string; error?: string; composeOutput?: string; composeError?: string } - isOk: operation success, alreadyStarted: machine was already running, port: allocated host port, output: command output, error: error message if failed, composeOutput: podman compose output, composeError: podman compose error
	 */
	async startPodmanMachine(_event: IpcMainInvokeEvent): Promise<{
		isOk: boolean;
		alreadyStarted?: boolean;
		port?: number;
		openClawPort?: number;
		output?: string;
		error?: string;
		composeOutput?: string;
		composeError?: string;
	}> {
		const platform = process.platform;
		this.isOperating = true;

		try {
			// On Linux, Podman runs rootless without a VM - skip machine start
			if (platform === "linux") {
				console.log("[Local Vibe] Linux detected, skipping machine start (rootless mode)");

				// Execute podman compose up -d directly
				const composeResult = await this.runPodmanComposeUp();

				if (!composeResult.isOk) {
					return {
						isOk: false,
						error: composeResult.error,
					};
				}

				// Start local sandbox health check
				await new Promise((resolve) => setTimeout(resolve, 3000));
				await this.startLocalSandboxHealthCheck();

				return {
					isOk: true,
					alreadyStarted: false,
					port: composeResult.port,
					openClawPort: composeResult.openClawPort,
					output: "Linux rootless mode - no machine needed",
					composeOutput: composeResult.output,
					composeError: composeResult.error,
				};
			}

			// macOS/Windows: Check if machine exists before starting
			const machineCheck = await this.checkPodmanMachineExists();
			if (!machineCheck.isOk) {
				const errorMsg = await this.t(
					"无法检查 Podman 机器状态",
					"Failed to check Podman machine status",
				);
				return { isOk: false, error: errorMsg };
			}

			// Initialize machine if it doesn't exist
			if (!machineCheck.exists) {
				console.log("[Local Vibe] Machine 'ai302-machine' does not exist, initializing...");
				const initMsg = await this.t(
					"Podman 机器不存在，正在初始化...",
					"Podman machine does not exist, initializing...",
				);
				broadcastService.broadcastChannelToAll("install-log", {
					step: "podman-machine-init",
					type: "stdout",
					data: initMsg,
				});

				const initResult = await this._initPodmanMachine();
				if (!initResult.isOk) {
					const initErrorMsg = await this.t(
						"初始化 Podman 机器失败",
						"Failed to initialize Podman machine",
					);
					return { isOk: false, error: initErrorMsg };
				}
			}

			// Apply VM resource config if flagged (machine must be stopped at this point)
			// - Existing machine: run `podman machine set` to update CPU/memory to required values
			// - Newly initialized machine: `init` already applied correct values, just clear the flag
			const { data: localVibeData } = await localVibeStorage.getData();
			if (localVibeData.needUpdateVmConfig) {
				if (machineCheck.exists) {
					console.log("[Local Vibe] Applying VM config update (--cpus 4 --memory 4096)...");
					await this.runCommandWithBroadcast(
						"podman",
						["machine", "set", "ai302-machine", "--cpus", "4", "--memory", "4096"],
						"podman-machine-set",
					);
				}
				await localVibeStorage.setData({ needUpdateVmConfig: false });
			}

			// Start the Podman machine
			const startResult = await this.runCommandWithBroadcast(
				"podman",
				["machine", "start", "ai302-machine"],
				"podman-machine-start",
			);

			const output = startResult.output;
			let alreadyStarted = false;

			if (!startResult.isOk) {
				const errorMessage = startResult.output;

				// Check if already running
				// Based on actual Podman error: "Error: unable to start "ai302-machine": already running"
				if (errorMessage.includes("already running")) {
					alreadyStarted = true;
					console.log(
						"[Local Vibe] Machine reports 'already running', checking if it's actually ready...",
					);

					// Wait for Podman to be ready even if machine is already running
					const ready = await this.waitForPodmanReady(60_000); // 60 second timeout
					if (!ready) {
						console.log(
							"[Local Vibe] Podman not responding despite machine being 'running', attempting recovery...",
						);

						// Machine reports running but not responding - try to stop and restart
						const stopMsg = await this.t(
							"Podman machine 响应超时，正在尝试重启...",
							"Podman machine not responding, attempting restart...",
						);
						broadcastService.broadcastChannelToAll("install-log", {
							step: "podman-machine-recover",
							type: "stderr",
							data: stopMsg,
						});

						// Stop the machine forcefully
						await this.runCommandWithBroadcast(
							"podman",
							["machine", "stop", "ai302-machine"],
							"podman-machine-stop-recovery",
						);

						// Wait a moment
						await new Promise((resolve) => setTimeout(resolve, 3000));

						// Start the machine again
						const restartResult = await this.runCommandWithBroadcast(
							"podman",
							["machine", "start", "ai302-machine"],
							"podman-machine-start-recovery",
						);

						if (!restartResult.isOk) {
							const restartErrorMsg = await this.t(
								"重启 Podman machine 失败，请手动重启计算机后再试",
								"Failed to restart Podman machine, please restart your computer and try again",
							);
							return { isOk: false, error: restartErrorMsg };
						}

						// Wait for it to be ready after restart
						const restartReady = await this.waitForPodmanReady(60_000);
						if (!restartReady) {
							const timeoutMsg = await this.t(
								"Podman machine 重启后仍然超时，请手动检查 Podman 状态",
								"Podman machine still timing out after restart, please check Podman status manually",
							);
							return { isOk: false, error: timeoutMsg };
						}
					}
				} else if (isCommandNotFound(errorMessage)) {
					// Check if podman command is not found
					const notInstalledMsg = await this.t(
						"Podman 未安装。请先安装 Podman。",
						"Podman is not installed. Please install Podman first.",
					);
					return { isOk: false, error: notInstalledMsg };
				} else if (errorMessage.includes("All pipe instances are busy")) {
					// Handle specific WSL pipe error
					const pipeErrorMsg = await this.t(
						"WSL 管道冲突。请尝试以下步骤：\n1. 以管理员身份运行终端并执行 'wsl --update'\n2. 执行 'podman machine rm ai302-machine'\n3. 重新在应用中安装 Podman",
						"WSL pipe conflict detected. Please try:\n1. Run 'wsl --update' in Administrator terminal\n2. Run 'podman machine rm ai302-machine'\n3. Reinstall Podman in the app",
					);
					return { isOk: false, error: pipeErrorMsg };
				} else {
					// Other errors
					return { isOk: false, error: errorMessage };
				}
			}

			// Wait for Podman to be ready before running compose
			// This is especially important on Windows/WSL where machine startup takes time
			if (!alreadyStarted) {
				// Refresh PATH to ensure podman command is findable in current process
				await this.refreshWindowsPath();

				const ready = await this.waitForPodmanReady(60_000); // 60 second timeout
				if (!ready) {
					const timeoutMsg = await this.t(
						"Podman machine 启动超时，请检查 Podman 状态",
						"Podman machine startup timed out, please check Podman status",
					);
					return { isOk: false, error: timeoutMsg };
				}
			}

			// Execute podman compose up -d after successful start (or if already running)
			const composeResult = await this.runPodmanComposeUp();

			// Start local sandbox health check
			await new Promise((resolve) => setTimeout(resolve, 3000));
			await this.startLocalSandboxHealthCheck();

			return {
				isOk: true,
				alreadyStarted,
				port: composeResult?.port,
				openClawPort: composeResult?.openClawPort,
				output,
				composeOutput: composeResult?.output,
				composeError: composeResult?.error,
			};
		} finally {
			this.isOperating = false;
		}
	}

	async restartPodmanMachine(_event: IpcMainInvokeEvent) {
		const execAsync = promisify(exec);
		await execAsync("podman restart local-cc-api");
	}

	/**
	 * Recursively merges template config into existing config.
	 * Adds new fields from template that don't exist in existing config.
	 * Preserves existing values (user customizations take priority).
	 */
	private _mergeTemplateIntoExistingConfig(
		existingConfig: Record<string, unknown>,
		templateConfig: Record<string, unknown>,
	): Record<string, unknown> {
		const merged = JSON.parse(JSON.stringify(existingConfig)) as Record<string, unknown>;

		const mergeDeep = (
			target: Record<string, unknown>,
			source: Record<string, unknown>,
			path = "",
		) => {
			for (const key in source) {
				const currentPath = path ? `${path}.${key}` : key;
				const sourceValue = source[key];
				const targetValue = target[key];

				if (!(key in target)) {
					// Template has field that existing config doesn't have -> add it
					target[key] = sourceValue;
					console.log(`[Local Vibe] Added new config field: ${currentPath}`);
				} else if (
					typeof sourceValue === "object" &&
					sourceValue !== null &&
					!Array.isArray(sourceValue) &&
					typeof targetValue === "object" &&
					targetValue !== null &&
					!Array.isArray(targetValue)
				) {
					// Both are plain objects -> recursive merge
					mergeDeep(
						targetValue as Record<string, unknown>,
						sourceValue as Record<string, unknown>,
						currentPath,
					);
				}
				// Otherwise: keep existing value (user customization takes priority)
			}
		};

		mergeDeep(merged, templateConfig);
		return merged;
	}

	/**
	 * Helper method to fetch app-models and merge them into the given OpenClaw configuration object
	 */
	private async _mergeModelsIntoOpenclawConfig(config: Record<string, unknown>): Promise<void> {
		try {
			const appModels = (await storageService.getItemInternal("app-models")) as
				| Array<Record<string, unknown>>
				| undefined;

			if (Array.isArray(appModels)) {
				// cc-* models: only need providerId === "302AI"
				const ccModels = appModels.filter(
					(m) => m.providerId === "302AI" && (m.id as string).startsWith("cc-"),
				);
				// *-for-coding models: need all conditions
				const forCodingModels = appModels.filter(
					(m) =>
						m.providerId === "302AI" &&
						(m.id as string).endsWith("-for-coding") &&
						m.isFeatured === true &&
						m.openai_compatible === true,
				);
				// Standard models: need all conditions
				const ai302Models = appModels.filter(
					(m) =>
						m.providerId === "302AI" &&
						!(m.id as string).startsWith("cc-") &&
						!(m.id as string).endsWith("-for-coding") &&
						m.isFeatured === true &&
						m.openai_compatible === true,
				);

				// Combine coding models
				const ai302CodingModels = [...ccModels, ...forCodingModels];

				if (ai302Models.length > 0 || ai302CodingModels.length > 0) {
					// Ensure nested path exists using set
					if (!get(config, "agents.defaults.models")) {
						set(config, "agents.defaults.models", {});
					}

					// Get existing models using es-toolkit get
					const existingModels = get(config, "agents.defaults.models") as Record<string, unknown>;

					// Clear all ai302-prefixed models before adding new ones
					// Preserve models with other prefixes
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const nonAi302Models: Record<string, any> = {};

					for (const [key, value] of Object.entries(existingModels)) {
						if (!key.startsWith("ai302/")) {
							nonAi302Models[key] = value;
						}
					}

					// Replace models with only non-ai302 models
					set(config, "agents.defaults.models", nonAi302Models);

					// Add fresh ai302 models
					const newModels = { ...nonAi302Models };

					// Add standard ai302 models
					ai302Models.forEach((m) => {
						newModels[`ai302/${m.id}`] = {};
					});

					// Add ai302-coding models
					ai302CodingModels.forEach((m) => {
						newModels[`ai302-coding/${m.id}`] = {};
					});

					set(config, "agents.defaults.models", newModels);
				}
			}
		} catch (error) {
			console.warn(
				"[Local Vibe] Failed to fetch and parse app-models for openclaw configuration",
				error,
			);
		}
	}

	/**
	 * Updates the agents.defaults.models inside openclaw.json based on current app-models
	 * Called via IPC from the renderer process
	 */
	async updateOpenclawModels(
		_event: IpcMainInvokeEvent,
	): Promise<{ success: boolean; error?: string }> {
		try {
			const runtimeDir = this.getRuntimeComposeDir();
			const openclawFilePath = path.join(runtimeDir, ".openclaw", "openclaw.json");

			if (!fs.existsSync(openclawFilePath)) {
				return { success: false, error: "openclaw.json does not exist" };
			}

			const content = fs.readFileSync(openclawFilePath, "utf-8");
			const config = JSON.parse(content);

			await this._mergeModelsIntoOpenclawConfig(config);

			fs.writeFileSync(openclawFilePath, JSON.stringify(config, null, 2), "utf-8");
			return { success: true };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("[Local Vibe] Failed to update openclaw.json models:", errorMessage);
			return { success: false, error: errorMessage };
		}
	}
}

export const localVibeService = new LocalVibeService();
