import { isDev } from "@electron/main/constants";
import type { ImportResult } from "@shared/types";
import archiver from "archiver";
import { type IpcMainInvokeEvent, app, dialog } from "electron";
import extract from "extract-zip";
import { createWriteStream, existsSync } from "fs";
import { cp, mkdir, readdir, readFile, rm } from "fs/promises";
import { join } from "path";
import type { BackupInfo } from "@shared/types";
import { userDataManager } from "../app-service/user-data-manager";
import { importLegacyJson } from "./legacy-import";

export class DataService {
	private storagePath: string;

	constructor() {
		this.storagePath = isDev
			? join(process.cwd(), "storage")
			: join(userDataManager.storagePath, "storage");
	}

	async importLegacyJson(_event: IpcMainInvokeEvent): Promise<ImportResult> {
		try {
			const storagePath = this.storagePath;

			// Create backup before importing legacy data
			const backupPath = await this.createBackupToDirectory(storagePath);
			console.log(`Backup created before legacy import: ${backupPath}`);

			try {
				const result = await importLegacyJson();

				if (result.success) {
					// Clean up old backups on success
					userDataManager.cleanupOldBackups(5);

					return {
						...result,
						message: `${result.message}. A backup was created before import.`,
						backupPath,
					};
				}

				return result;
			} catch (error) {
				// Restore backup on error
				await this.restoreBackup(backupPath, storagePath);
				throw error;
			}
		} catch (error) {
			console.error("Failed to import legacy JSON:", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	}

	/**
	 * Export storage folder as a zip file
	 * @returns The path to the exported zip file, or null if cancelled
	 */
	async exportStorage(_event: IpcMainInvokeEvent): Promise<string | null> {
		try {
			// Get storage path
			const storagePath = this.storagePath;

			// Show save dialog
			const { canceled, filePath } = await dialog.showSaveDialog({
				title: "Export Storage Data",
				defaultPath: `302ai-studio-backup-${new Date().toISOString().split("T")[0]}.zip`,
				filters: [{ name: "Zip Archive", extensions: ["zip"] }],
			});

			if (canceled || !filePath) {
				return null;
			}

			// Create zip file
			await this.createZipFromFolder(storagePath, filePath);

			return filePath;
		} catch (error) {
			console.error("Failed to export storage:", error);
			throw error;
		}
	}

	/**
	 * Import storage data from a zip file
	 * @returns ImportResult with success status and details
	 */
	async importStorage(_event: IpcMainInvokeEvent): Promise<ImportResult> {
		try {
			// Get storage path
			const storagePath = this.storagePath;

			// Show open dialog
			const { canceled, filePaths } = await dialog.showOpenDialog({
				title: "Import Storage Data",
				filters: [{ name: "Zip Archive", extensions: ["zip"] }],
				properties: ["openFile"],
			});

			if (canceled || filePaths.length === 0) {
				return {
					success: false,
					message: "Import cancelled by user",
				};
			}

			const zipPath = filePaths[0];

			// Create backup of current storage to the backups directory
			const backupPath = await this.createBackupToDirectory(storagePath);

			try {
				// Validate zip file
				const isValid = await this.validateZipFile(zipPath);
				if (!isValid) {
					// Restore backup if validation fails
					await this.restoreBackup(backupPath, storagePath);
					return {
						success: false,
						message: "Invalid backup file format",
					};
				}

				// Extract and merge data
				const importedFiles = await this.extractAndMergeData(zipPath, storagePath);

				// Clean up old backups (keep last 5)
				userDataManager.cleanupOldBackups(5);

				return {
					success: true,
					message: `Successfully imported ${importedFiles} files. A backup was created before import.`,
					importedFiles,
					backupPath,
				};
			} catch (error) {
				// Restore backup on error
				await this.restoreBackup(backupPath, storagePath);
				throw error;
			}
		} catch (error) {
			console.error("Failed to import storage:", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	}

	/**
	 * Get list of all backups
	 */
	async listBackups(_event: IpcMainInvokeEvent): Promise<BackupInfo[]> {
		return userDataManager.listBackups();
	}

	/**
	 * Restore from a specific backup
	 */
	async restoreFromBackup(_event: IpcMainInvokeEvent, backupPath: string): Promise<ImportResult> {
		try {
			const storagePath = this.storagePath;

			// Validate backup exists
			if (!existsSync(backupPath)) {
				return {
					success: false,
					message: "Backup not found",
				};
			}

			// Create a backup of current state before restoring
			const preRestoreBackup = await this.createBackupToDirectory(storagePath);

			try {
				// Restore from backup
				await this.restoreBackup(backupPath, storagePath);

				// Clean up old backups
				userDataManager.cleanupOldBackups(5);

				return {
					success: true,
					message: "Successfully restored from backup",
					backupPath: preRestoreBackup,
				};
			} catch (error) {
				// If restore fails, restore the pre-restore backup
				await this.restoreBackup(preRestoreBackup, storagePath);
				throw error;
			}
		} catch (error) {
			console.error("Failed to restore from backup:", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	}

	/**
	 * Delete a specific backup
	 */
	async deleteBackup(_event: IpcMainInvokeEvent, backupPath: string): Promise<boolean> {
		try {
			if (!existsSync(backupPath)) {
				return false;
			}
			await rm(backupPath, { recursive: true, force: true });
			console.log(`Backup deleted: ${backupPath}`);
			return true;
		} catch (error) {
			console.error("Failed to delete backup:", error);
			return false;
		}
	}

	/**
	 * Open backup directory in file explorer
	 */
	async openBackupDirectory(_event: IpcMainInvokeEvent): Promise<void> {
		const { shell } = await import("electron");
		const backupDir = userDataManager.getBackupDirectory();
		await shell.openPath(backupDir);
	}

	/**
	 * Create a backup of the current storage folder (legacy method for temporary backups)
	 */
	private async createBackup(storagePath: string): Promise<string> {
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const backupPath = `${storagePath}_backup_${timestamp}`;

		await cp(storagePath, backupPath, { recursive: true });
		console.log(`Temporary backup created at: ${backupPath}`);

		return backupPath;
	}

	/**
	 * Create a backup in the backups directory
	 */
	private async createBackupToDirectory(storagePath: string): Promise<string> {
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const backupDir = userDataManager.getBackupDirectory();
		const backupPath = join(backupDir, `backup_${timestamp}`);

		await cp(storagePath, backupPath, { recursive: true });
		console.log(`Backup created at: ${backupPath}`);

		return backupPath;
	}

	/**
	 * Restore storage from backup
	 */
	private async restoreBackup(backupPath: string, storagePath: string): Promise<void> {
		try {
			// Remove current storage
			await rm(storagePath, { recursive: true, force: true });
			// Restore from backup
			await cp(backupPath, storagePath, { recursive: true });
			console.log("Storage restored from backup");
		} catch (error) {
			console.error("Failed to restore backup:", error);
			throw error;
		}
	}

	/**
	 * Validate that the zip file contains valid storage structure
	 */
	private async validateZipFile(zipPath: string): Promise<boolean> {
		try {
			// Simple validation: just check if it's a valid zip file
			// by trying to read it
			await readFile(zipPath);
			return true;
		} catch (error) {
			console.error("Invalid zip file:", error);
			return false;
		}
	}

	/**
	 * Extract zip and merge with existing data
	 */
	private async extractAndMergeData(zipPath: string, storagePath: string): Promise<number> {
		const tempExtractPath = join(storagePath, "_temp_import");

		try {
			// Create temp directory
			await mkdir(tempExtractPath, { recursive: true });

			// Extract zip to temp location
			await this.extractZip(zipPath, tempExtractPath);

			// Count files in temp directory
			const files = await this.getAllFiles(tempExtractPath);
			const importedFiles = files.length;

			// Merge: copy all files from temp to storage (overwrites existing)
			await this.mergeDirectories(tempExtractPath, storagePath);

			// Clean up temp directory
			await rm(tempExtractPath, { recursive: true, force: true });

			return importedFiles;
		} catch (error) {
			// Clean up temp directory on error
			await rm(tempExtractPath, { recursive: true, force: true });
			throw error;
		}
	}

	/**
	 * Extract zip file to destination
	 */
	private async extractZip(zipPath: string, destPath: string): Promise<void> {
		try {
			await extract(zipPath, { dir: destPath });
		} catch (error) {
			console.error("Failed to extract zip:", error);
			throw error;
		}
	}

	/**
	 * Get all files recursively from a directory
	 */
	private async getAllFiles(dirPath: string): Promise<string[]> {
		const files: string[] = [];

		async function walk(dir: string) {
			const entries = await readdir(dir, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = join(dir, entry.name);
				if (entry.isDirectory()) {
					await walk(fullPath);
				} else {
					files.push(fullPath);
				}
			}
		}

		await walk(dirPath);
		return files;
	}

	/**
	 * Merge directories: copy all files from source to dest
	 */
	private async mergeDirectories(source: string, dest: string): Promise<void> {
		const entries = await readdir(source, { withFileTypes: true });

		for (const entry of entries) {
			const sourcePath = join(source, entry.name);
			const destPath = join(dest, entry.name);

			if (entry.isDirectory()) {
				// Create directory if it doesn't exist
				await mkdir(destPath, { recursive: true });
				// Recursively merge subdirectories
				await this.mergeDirectories(sourcePath, destPath);
			} else {
				// Copy file (overwrites if exists)
				await cp(sourcePath, destPath);
			}
		}
	}

	private createZipFromFolder(sourceDir: string, outputPath: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const output = createWriteStream(outputPath);
			const archive = archiver("zip", {
				zlib: { level: 9 }, // Maximum compression
			});

			output.on("close", () => {
				console.log(`Storage exported: ${archive.pointer()} total bytes`);
				resolve();
			});

			archive.on("error", (err) => {
				reject(err);
			});

			archive.pipe(output);
			archive.directory(sourceDir, false);
			archive.finalize();
		});
	}

	async checkOldVersionData(_event: IpcMainInvokeEvent): Promise<boolean> {
		const triplitPath = join(app.getPath("userData"), "../", "302 AI Studio", "triplit");
		console.log(triplitPath);
		return existsSync(triplitPath);
	}
}

export const dataService = new DataService();
