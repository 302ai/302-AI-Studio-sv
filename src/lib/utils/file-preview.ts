import { compressFile } from "./file-compressor";

/**
 * Maximum number of attachments allowed per message
 */
export const MAX_ATTACHMENT_COUNT = 5;

/**
 * Maximum file size in MB
 */
export const MAX_FILE_SIZE_MB = 10;

/**
 * Maximum file size in bytes
 */
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Supported Office document MIME types
 */
export const officeMimeTypes = [
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"application/vnd.ms-powerpoint",
];

/**
 * Supported Office document file extensions
 */
export const officeExtensions = [".xlsx", ".xls", ".docx", ".doc", ".pptx", ".ppt"];

/**
 * Generate preview for different file types
 * @param file - The file to generate preview for
 * @returns Preview URL as data URL or undefined if not supported
 */
export async function generateFilePreview(file: File): Promise<string | undefined> {
	// Handle image files with compression
	if (file.type.startsWith("image/")) {
		try {
			const compressedDataURL = await compressFile(file);
			return compressedDataURL;
		} catch (error) {
			console.error("[File Preview] Failed to compress image:", error);
			// Fallback to original if compression fails
			return new Promise((resolve) => {
				const reader = new FileReader();
				reader.onload = (e) => resolve(e.target?.result as string);
				reader.onerror = () => resolve(undefined);
				reader.readAsDataURL(file);
			});
		}
	}

	// Handle video files (generate thumbnail)
	if (file.type.startsWith("video/")) {
		return new Promise((resolve) => {
			const video = document.createElement("video");
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");

			video.onloadeddata = () => {
				canvas.width = video.videoWidth;
				canvas.height = video.videoHeight;

				if (ctx) {
					ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
					const thumbnailUrl = canvas.toDataURL("image/jpeg");
					resolve(thumbnailUrl);
				} else {
					resolve(undefined);
				}

				URL.revokeObjectURL(video.src);
			};

			video.onerror = () => {
				try {
					resolve(URL.createObjectURL(file));
				} catch {
					resolve(undefined);
				}
			};

			video.src = URL.createObjectURL(file);
			video.currentTime = 0.1;
			video.load();
		});
	}

	// Handle PDF files
	if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
		return new Promise((resolve) => {
			const reader = new FileReader();
			reader.onload = (e) => resolve(e.target?.result as string);
			reader.onerror = () => resolve(undefined);
			reader.readAsDataURL(file);
		});
	}

	// Handle Office documents
	const isOfficeFile =
		officeMimeTypes.includes(file.type) ||
		officeExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

	if (isOfficeFile) {
		return new Promise((resolve) => {
			const reader = new FileReader();
			reader.onload = (e) => resolve(e.target?.result as string);
			reader.onerror = () => resolve(undefined);
			reader.readAsDataURL(file);
		});
	}

	return undefined;
}
