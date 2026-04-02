import type { FileNode, Theme } from "@shared/types";
import { createLogger } from "@shared/logger";

const logger = createLogger("services");
import {
	app,
	BrowserWindow,
	nativeTheme,
	WebContentsView,
	type IpcMainInvokeEvent,
} from "electron";
import extract from "extract-zip";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { CONFIG, isMac, UNSUPPORTED_INJECTING_THEME } from "../../constants";
import { getCustomUserAgentFragment } from "../../utils/user-agent";
import { themeStorage } from "../storage-service/theme-storage";

export class AppService {
	async getUserAgentFragment(_event: IpcMainInvokeEvent): Promise<string> {
		return getCustomUserAgentFragment();
	}

	async initFromStorage() {
		const state = await themeStorage.getThemeState();
		logger.info(`state = ${JSON.stringify(state)}, ${typeof state}`);

		if (state === null) {
			logger.warn("Unable to load themeState from storage");
			return;
		}

		nativeTheme.themeSource = state.theme;
	}

	async getTheme(_event: IpcMainInvokeEvent): Promise<Theme> {
		const state = await themeStorage.getThemeState();
		if (state === null) {
			// Fallback to system theme if no saved theme
			return "system";
		}
		return state.theme;
	}

	async setTheme(_event: IpcMainInvokeEvent, theme: Theme): Promise<void> {
		nativeTheme.themeSource = theme;
		const allWindows = BrowserWindow.getAllWindows();
		allWindows.forEach((window) => {
			window.setBackgroundColor(nativeTheme.shouldUseDarkColors ? "#121212" : "#F9F9F9");
			if (!isMac) {
				try {
					window.setTitleBarOverlay(
						nativeTheme.shouldUseDarkColors
							? CONFIG.TITLE_BAR_OVERLAY.DARK
							: CONFIG.TITLE_BAR_OVERLAY.LIGHT,
					);
				} catch (_error) {
					// Skip windows that don't have titleBarOverlay enabled (e.g., settings window)
					logger.debug(`Skipping titleBarOverlay for window "${window.getTitle()}"`);
				}
			}

			const contentViews = window.contentView.children;
			contentViews.forEach((view) => {
				if (view && "webContents" in view) {
					const webContentsView = view as WebContentsView;
					const url = webContentsView.webContents.getURL();
					if (!url.includes("shell")) {
						const backgroundColor = nativeTheme.shouldUseDarkColors ? "#121212" : "#F9F9F9";
						webContentsView.setBackgroundColor(backgroundColor);
					}
					if (!webContentsView.webContents.isDestroyed()) {
						const isExternalPage =
							url &&
							!url.startsWith("app://") &&
							!url.includes("localhost") &&
							!url.includes("127.0.0.1") &&
							!UNSUPPORTED_INJECTING_THEME.some((domain) =>
								new URL(url).hostname.endsWith(`${domain}`),
							);
						if (isExternalPage) {
							this.updateWebContentsTheme(webContentsView.webContents);
						}
					}
				}
			});
		});
	}

	private updateWebContentsTheme(webContents: Electron.WebContents) {
		if (webContents.isDestroyed()) return;

		const isDark = nativeTheme.shouldUseDarkColors;
		const colorScheme = isDark ? "dark" : "light";
		const oppositeScheme = isDark ? "light" : "dark";

		const themeCSS = `
			:root {
				color-scheme: ${colorScheme} !important;
			}
			html {
				color-scheme: ${colorScheme} !important;
			}
			body {
				color-scheme: ${colorScheme} !important;
			}
		`;

		webContents.insertCSS(themeCSS).catch((err) => {
			logger.warn("Failed to inject theme CSS:", err);
		});

		webContents
			.executeJavaScript(
				`
			(function() {
				const colorScheme = '${colorScheme}';
				const oppositeScheme = '${oppositeScheme}';
				const isDark = ${isDark};

				function applyTheme() {
					// Set on document element
					document.documentElement.style.colorScheme = colorScheme;

					// Remove opposite theme class and add current theme class
					document.documentElement.classList.remove(oppositeScheme);
					document.documentElement.classList.add(colorScheme);

					// Also handle html and body
					if (document.body) {
						document.body.style.colorScheme = colorScheme;
						document.body.classList.remove(oppositeScheme);
						document.body.classList.add(colorScheme);
					}

					// Update or create meta tag
					let meta = document.querySelector('meta[name="color-scheme"]');
					if (meta) {
						meta.setAttribute('content', colorScheme);
					} else {
						meta = document.createElement('meta');
						meta.name = 'color-scheme';
						meta.content = colorScheme;
						if (document.head) {
							document.head.appendChild(meta);
						}
					}
				}

				// Apply immediately
				applyTheme();

				// Watch for class changes and force our theme
				if (window.__themeObserver) {
					window.__themeObserver.disconnect();
				}

				const observer = new MutationObserver(function(mutations) {
					mutations.forEach(function(mutation) {
						if (mutation.type === 'attributes' &&
							(mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
							const target = mutation.target;
							if (target === document.documentElement || target === document.body) {
								// Reapply if wrong class is added
								if (target.classList.contains(oppositeScheme)) {
									target.classList.remove(oppositeScheme);
									target.classList.add(colorScheme);
								}
								// Ensure color-scheme style is maintained
								if (target.style.colorScheme !== colorScheme) {
									target.style.colorScheme = colorScheme;
								}
							}
						}
					});
				});

				observer.observe(document.documentElement, {
					attributes: true,
					attributeFilter: ['class', 'style']
				});

				if (document.body) {
					observer.observe(document.body, {
						attributes: true,
						attributeFilter: ['class', 'style']
					});
				}

				window.__themeObserver = observer;
			})();
		`,
			)
			.catch((err) => {
				logger.warn("Failed to set color-scheme:", err);
			});
	}

	/**
	 * Restart the entire Electron application
	 */
	async restartApp(_event: IpcMainInvokeEvent): Promise<void> {
		logger.info("Restarting application...");
		app.relaunch();
		app.exit(0);
	}

	/**
	 * Reset all application data and restart
	 */
	async resetAllData(_event: IpcMainInvokeEvent): Promise<void> {
		logger.info("Resetting all data...");
		const { storageService } = await import("../storage-service");
		await storageService.clear(_event);
		logger.info("All data cleared, restarting...");
		app.relaunch();
		app.exit(0);
	}

	/**
	 * Clear only chat history (threads and messages) but keep settings
	 */
	async clearChatHistory(_event: IpcMainInvokeEvent): Promise<void> {
		logger.info("Clearing chat history...");
		const { storageService } = await import("../storage-service");
		const { tabStorage } = await import("../storage-service/tab-storage");

		try {
			// Get all storage keys
			const allKeys = await storageService.getKeys(_event);
			logger.info("All storage keys:", allKeys);

			// Filter and delete chat messages and threads
			const chatAndThreadKeys = allKeys.filter(
				(key) => key.startsWith("app-chat-messages:") || key.startsWith("app-thread:"),
			);

			logger.info("Deleting chat and thread keys:", chatAndThreadKeys);
			for (const key of chatAndThreadKeys) {
				await storageService.removeItem(_event, key);
			}

			// Remove tab-bar-state file (will be recreated on restart with new initial tab)
			logger.info("Removing tab-bar-state...");
			await tabStorage.removeItem(_event, "tab-bar-state");

			logger.info("Chat history cleared, restarting...");
			app.relaunch();
			app.exit(0);
		} catch (error) {
			logger.error("Failed to clear chat history:", error);
			throw error;
		}
	}

	/**
	 * Extract a zip file from ArrayBuffer to a temporary directory
	 * @param zipData - The zip file data as ArrayBuffer
	 * @param originalFileName - Optional original file name for better identification
	 * @returns The path to the extracted directory
	 */
	async extractZipBlob(
		_event: IpcMainInvokeEvent,
		zipData: ArrayBuffer,
		originalFileName?: string,
	): Promise<string> {
		try {
			const tempDir = app.getPath("temp");
			const timestamp = Date.now();

			// Sanitize original file name if provided
			const baseName = originalFileName
				? originalFileName.replace(/\.zip$/i, "").replace(/[<>:"/\\|?*]/g, "_")
				: `skill-download-${timestamp}`;

			const zipFileName = `${baseName}.zip`;
			const zipPath = join(tempDir, zipFileName);
			const extractPath = join(tempDir, baseName);

			logger.info(`[extractZipBlob] zipPath: ${zipPath}, extractPath: ${extractPath}`);

			// Write zip file
			await writeFile(zipPath, Buffer.from(zipData));
			logger.info(`[extractZipBlob] ZIP file written, size: ${zipData.byteLength} bytes`);

			// Clean existing directory before extraction to avoid stale files
			try {
				await rm(extractPath, { recursive: true, force: true });
				logger.info(`[extractZipBlob] Cleaned existing directory`);
			} catch {
				// Directory might not exist, ignore error
			}

			// Create extract directory
			await mkdir(extractPath, { recursive: true });

			// Extract
			await this.extractZip(zipPath, extractPath);
			logger.info(`[extractZipBlob] Extraction completed`);

			// Verify extraction by listing files
			const extractedFiles = await readdir(extractPath);
			logger.info(`[extractZipBlob] Extracted files: ${extractedFiles.join(", ")}`);

			if (extractedFiles.length === 0) {
				logger.warn(`[extractZipBlob] Warning: No files extracted to ${extractPath}`);
			}

			// Cleanup zip file
			await rm(zipPath, { force: true });

			return extractPath;
		} catch (error) {
			logger.error("Failed to extract zip blob:", error);
			throw error;
		}
	}

	/**
	 * Recursively scan a directory and return a file tree structure
	 */
	async scanDirectory(_event: IpcMainInvokeEvent, dirPath: string): Promise<FileNode> {
		try {
			const stats = await stat(dirPath);
			const name = dirPath.split(/[/\\]/).pop() || "";

			if (!stats.isDirectory()) {
				return {
					name,
					path: dirPath,
					type: "file",
				};
			}

			const children: FileNode[] = [];
			const entries = await readdir(dirPath);

			for (const entry of entries) {
				// Skip hidden files/folders (optional, but usually good practice)
				if (entry.startsWith(".")) continue;

				const fullPath = join(dirPath, entry);
				const childNode = await this.scanDirectory(_event, fullPath);
				children.push(childNode);
			}

			// Sort: directories first, then files, both alphabetically
			children.sort((a, b) => {
				if (a.type === b.type) {
					return a.name.localeCompare(b.name);
				}
				return a.type === "directory" ? -1 : 1;
			});

			return {
				name,
				path: dirPath,
				type: "directory",
				children,
			};
		} catch (error) {
			logger.error("Failed to scan directory:", error);
			throw error;
		}
	}

	/**
	 * Read file content as text
	 */
	async readFile(_event: IpcMainInvokeEvent, filePath: string): Promise<string> {
		try {
			return await readFile(filePath, "utf-8");
		} catch (error) {
			logger.error("Failed to read file:", error);
			throw error;
		}
	}

	/**
	 * Read file content as ArrayBuffer (for binary files like PDF)
	 */
	async readFileAsBuffer(_event: IpcMainInvokeEvent, filePath: string): Promise<ArrayBuffer> {
		try {
			const buffer = await readFile(filePath);
			return buffer.buffer.slice(
				buffer.byteOffset,
				buffer.byteOffset + buffer.byteLength,
			) as ArrayBuffer;
		} catch (error) {
			logger.error("Failed to read file as buffer:", error);
			throw error;
		}
	}

	/**
	 * Write content to a file
	 */
	async writeFile(_event: IpcMainInvokeEvent, filePath: string, content: string): Promise<void> {
		try {
			await writeFile(filePath, content, "utf-8");
		} catch (error) {
			logger.error("Failed to write file:", error);
			throw error;
		}
	}

	/**
	 * Create a directory
	 */
	async createDirectory(_event: IpcMainInvokeEvent, dirPath: string): Promise<void> {
		try {
			await mkdir(dirPath, { recursive: true });
		} catch (error) {
			logger.error("Failed to create directory:", error);
			throw error;
		}
	}

	/**
	 * Delete a file
	 */
	async deleteFile(_event: IpcMainInvokeEvent, filePath: string): Promise<void> {
		try {
			await rm(filePath, { force: true });
		} catch (error) {
			logger.error("Failed to delete file:", error);
			throw error;
		}
	}

	/**
	 * Delete a directory recursively
	 */
	async deleteDirectory(_event: IpcMainInvokeEvent, dirPath: string): Promise<void> {
		try {
			await rm(dirPath, { recursive: true, force: true });
		} catch (error) {
			logger.error("Failed to delete directory:", error);
			throw error;
		}
	}

	/**
	 * Rename a file or directory
	 */
	async renameFile(_event: IpcMainInvokeEvent, oldPath: string, newPath: string): Promise<void> {
		try {
			// Check if source file/directory exists before renaming
			try {
				await stat(oldPath);
			} catch {
				throw new Error(`Source file does not exist: ${oldPath}`);
			}
			await rename(oldPath, newPath);
		} catch (error) {
			logger.error("Failed to rename file:", error);
			throw error;
		}
	}

	/**
	 * Zip a directory and return the zip file as ArrayBuffer
	 * @param dirPath The directory to zip
	 * @param zipName The name for the zip file (without .zip extension)
	 * @returns ArrayBuffer of the zip file
	 */
	async zipDirectory(
		_event: IpcMainInvokeEvent,
		dirPath: string,
		zipName: string,
	): Promise<ArrayBuffer> {
		try {
			const archiver = await import("archiver");
			const { createWriteStream } = await import("fs");

			const tempDir = app.getPath("temp");
			const zipPath = join(tempDir, `${zipName}.zip`);

			// Create a write stream for the zip file
			const output = createWriteStream(zipPath);
			const archive = archiver.default("zip", { zlib: { level: 9 } });

			// Pipe archive data to the file
			const archivePromise = new Promise<void>((resolve, reject) => {
				output.on("close", () => resolve());
				archive.on("error", (err) => reject(err));
			});

			archive.pipe(output);

			// Add the directory contents under the zipName folder
			archive.directory(dirPath, zipName);

			await archive.finalize();
			await archivePromise;

			// Read the zip file as ArrayBuffer
			const zipBuffer = await readFile(zipPath);

			// Cleanup the temp zip file
			await rm(zipPath, { force: true });

			return (zipBuffer.buffer as ArrayBuffer).slice(
				zipBuffer.byteOffset,
				zipBuffer.byteOffset + zipBuffer.byteLength,
			);
		} catch (error) {
			logger.error("Failed to zip directory:", error);
			throw error;
		}
	}

	/**
	 * Extract zip file to destination
	 */
	private async extractZip(zipPath: string, destPath: string): Promise<void> {
		try {
			// extract-zip requires absolute paths
			const absoluteDestPath = resolve(destPath);
			logger.info(`[extractZip] Extracting to: ${absoluteDestPath}`);
			await extract(zipPath, { dir: absoluteDestPath });
		} catch (error) {
			logger.error("Failed to extract zip:", error);
			throw error;
		}
	}

	/**
	 * Create a temporary directory for manual skill creation preview
	 * @param skillName The skill name (used as subfolder name)
	 * @returns Object containing root path and SKILL.md path
	 */
	async createSkillTempDir(
		_event: IpcMainInvokeEvent,
		skillName: string,
	): Promise<{ rootPath: string; skillMdPath: string }> {
		try {
			const tempDir = app.getPath("temp");
			const timestamp = Date.now();
			const baseDirName = `skill-manual-${timestamp}`;
			const basePath = join(tempDir, baseDirName);
			const rootPath = join(basePath, skillName || "new-skill");
			const skillMdPath = join(rootPath, "SKILL.md");

			logger.info(`[createSkillTempDir] Creating directory: ${rootPath}`);
			await mkdir(rootPath, { recursive: true });

			// Verify directory was created
			const dirExists = await stat(rootPath)
				.then(() => true)
				.catch(() => false);
			logger.info(`[createSkillTempDir] Directory exists after mkdir: ${dirExists}`);

			// Create empty SKILL.md file
			logger.info(`[createSkillTempDir] Creating SKILL.md: ${skillMdPath}`);
			await writeFile(skillMdPath, "", "utf-8");

			// Verify file was created
			const fileExists = await stat(skillMdPath)
				.then(() => true)
				.catch(() => false);
			logger.info(`[createSkillTempDir] SKILL.md exists after writeFile: ${fileExists}`);

			// List directory contents
			const contents = await readdir(rootPath);
			logger.info(`[createSkillTempDir] Directory contents: ${contents.join(", ")}`);

			return { rootPath, skillMdPath };
		} catch (error) {
			logger.error("Failed to create skill temp directory:", error);
			throw error;
		}
	}

	/**
	 * Delete a temporary directory (with safety check)
	 * @param dirPath Path to delete (must be within temp directory)
	 */
	async deleteTempDir(_event: IpcMainInvokeEvent, dirPath: string): Promise<void> {
		try {
			const tempDir = app.getPath("temp");
			// Safety check: only delete if within temp directory
			const normalizedPath = dirPath.replace(/\\/g, "/");
			const normalizedTemp = tempDir.replace(/\\/g, "/");

			if (!normalizedPath.startsWith(normalizedTemp)) {
				throw new Error("Security: Can only delete directories within temp folder");
			}

			// Delete the base directory (parent of skill folder)
			const basePath = join(dirPath, "..");
			await rm(basePath, { recursive: true, force: true });
		} catch (error) {
			logger.error("Failed to delete temp directory:", error);
			// Don't throw - cleanup failures shouldn't block user
		}
	}
}

export const appService = new AppService();
