import type { BackupInfo } from "@shared/types";
import { app } from "electron";
import fs from "fs";
import path from "path";

export class UserDataManager {
	appName: string;
	storagePath: string;
	backupPath: string;

	constructor(appName: string) {
		this.appName = appName;
		this.storagePath = this.setupUserDataPath();
		this.backupPath = path.join(app.getPath("userData"), "backups");
		this.ensureDirectoryExists(this.backupPath);
		this.logPathInfo();
	}

	private setupUserDataPath(): string {
		const basePath = app.getPath("appData");
		const userDataPath = path.join(basePath, this.appName);
		app.setPath("userData", userDataPath);
		this.ensureDirectoryExists(userDataPath);
		return userDataPath;
	}

	private ensureDirectoryExists(dirPath: string) {
		if (!fs.existsSync(dirPath)) {
			fs.mkdirSync(dirPath, { recursive: true });
		}
	}

	private logPathInfo() {
		console.log("========== 路径信息 ==========");
		console.log("平台:", process.platform);
		console.log("userData 路径:", app.getPath("userData"));
		console.log("备份路径:", this.backupPath);
		console.log("==============================");
	}

	/**
	 * Get the backup directory path
	 */
	getBackupDirectory(): string {
		return this.backupPath;
	}

	/**
	 * List all available backups
	 */
	listBackups(): BackupInfo[] {
		if (!fs.existsSync(this.backupPath)) {
			return [];
		}

		const backups: BackupInfo[] = [];
		const entries = fs.readdirSync(this.backupPath, { withFileTypes: true });

		for (const entry of entries) {
			if (entry.isDirectory()) {
				const backupDir = path.join(this.backupPath, entry.name);
				const stats = fs.statSync(backupDir);

				// Parse timestamp from directory name (format: backup_2025-01-27T10-30-45-123Z)
				// Convert to ISO 8601: 2025-01-27T10:30:45.123Z
				const match = entry.name.match(/backup_(.+)/);
				let timestamp: Date;

				if (match) {
					// Replace time separators: T10-30-45-123Z -> T10:30:45.123Z
					const isoString = match[1].replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})/, "T$1:$2:$3.$4");
					timestamp = new Date(isoString);

					// Fallback to mtime if parsing failed
					if (isNaN(timestamp.getTime())) {
						timestamp = stats.mtime;
					}
				} else {
					timestamp = stats.mtime;
				}

				backups.push({
					path: backupDir,
					timestamp,
					size: this.getDirectorySize(backupDir),
				});
			}
		}

		// Sort by timestamp descending (newest first)
		return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
	}

	/**
	 * Get the size of a directory recursively
	 */
	private getDirectorySize(dirPath: string): number {
		let size = 0;

		const walk = (dir: string) => {
			const entries = fs.readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);
				if (entry.isDirectory()) {
					walk(fullPath);
				} else {
					const stats = fs.statSync(fullPath);
					size += stats.size;
				}
			}
		};

		walk(dirPath);
		return size;
	}

	/**
	 * Clean up old backups, keeping only the most recent N backups
	 */
	cleanupOldBackups(keepCount: number = 5): void {
		const backups = this.listBackups();

		if (backups.length <= keepCount) {
			return;
		}

		// Remove older backups
		for (let i = keepCount; i < backups.length; i++) {
			fs.rmSync(backups[i].path, { recursive: true, force: true });
			console.log(`Removed old backup: ${backups[i].path}`);
		}
	}
}

export const userDataManager = new UserDataManager("com.302ai.302aistudio");
