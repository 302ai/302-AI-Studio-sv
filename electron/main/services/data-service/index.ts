import { isDev } from "@electron/main/constants";
import archiver from "archiver";
import { type IpcMainInvokeEvent, app, dialog } from "electron";
import { createWriteStream } from "fs";
import { join } from "path";

export class DataService {
	/**
	 * Export storage folder as a zip file
	 * @returns The path to the exported zip file, or null if cancelled
	 */
	async exportStorage(_event: IpcMainInvokeEvent): Promise<string | null> {
		try {
			// Get storage path
			const storagePath = isDev
				? join(process.cwd(), "storage")
				: join(app.getPath("userData"), "storage");

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
}

export const dataService = new DataService();
