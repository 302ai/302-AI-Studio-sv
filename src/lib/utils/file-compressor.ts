/**
 * File compression utilities
 * Compresses files (especially images) to ensure base64 size < 1MB before storage
 */

import imageCompression from "browser-image-compression";

export const MAX_SIZE_BYTES = 1 * 1024 * 1024; // 1MB in bytes
const MAX_SIZE_MB = 1; // 1MB

/**
 * Estimate base64 size from file size
 * Base64 encoding increases size by ~33%
 */
function estimateBase64Size(fileSizeBytes: number): number {
	return Math.ceil((fileSizeBytes * 4) / 3);
}

/**
 * Get actual base64 size from data URL
 */
function getBase64Size(dataURL: string): number {
	// Remove data URL prefix (e.g., "data:image/png;base64,")
	const base64String = dataURL.split(",")[1] || dataURL;
	// Each base64 character is ~1 byte
	return base64String.length;
}

/**
 * Convert file to data URL
 */
async function fileToDataURL(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

/**
 * Compress an image file to ensure base64 size < 1MB
 * Uses browser-image-compression library for optimal compression
 * @param file - The image file to compress
 * @param maxSizeMB - Maximum size in MB (default: 1MB)
 * @returns Compressed file as data URL
 */
export async function compressImage(file: File, maxSizeMB: number = MAX_SIZE_MB): Promise<string> {
	// Check if file is an image
	if (!file.type.startsWith("image/")) {
		throw new Error("File is not an image");
	}

	try {
		console.log(`[Compression] Original file: ${file.name}, size: ${formatBytes(file.size)}`);

		// Configure compression options
		const options = {
			maxSizeMB: maxSizeMB,
			// Max iterations to try to reach target size
			maxIteration: 15,
			// Use web worker for better performance
			useWebWorker: true,
			// Initial quality
			initialQuality: 0.9,
			// Always keep resolution, only reduce quality if needed
			alwaysKeepResolution: false,
			// Preserve EXIF data
			preserveExif: false,
			// Progress callback (optional)
			onProgress: (progress: number) => {
				console.log(`[Compression] Progress: ${progress}%`);
			},
		};

		// Compress the image
		const compressedFile = await imageCompression(file, options);

		console.log(
			`[Compression] Compressed file: ${compressedFile.name}, size: ${formatBytes(compressedFile.size)}`,
		);
		console.log(
			`[Compression] Compression ratio: ${((1 - compressedFile.size / file.size) * 100).toFixed(1)}%`,
		);

		// Convert to data URL
		const dataURL = await fileToDataURL(compressedFile);

		// Check base64 size
		const base64Size = getBase64Size(dataURL);
		console.log(`[Compression] Base64 size: ${formatBytes(base64Size)}`);

		// If still too large, try more aggressive compression
		if (base64Size > maxSizeMB * 1024 * 1024) {
			console.warn(
				`[Compression] Base64 size still exceeds ${maxSizeMB}MB, trying more aggressive compression...`,
			);

			// Try with more aggressive settings
			const aggressiveOptions = {
				maxSizeMB: maxSizeMB * 0.7, // Target 70% of max size to account for base64 overhead
				maxIteration: 20,
				useWebWorker: true,
				initialQuality: 0.7,
				alwaysKeepResolution: false,
				preserveExif: false,
			};

			const recompressedFile = await imageCompression(file, aggressiveOptions);
			const recompressedDataURL = await fileToDataURL(recompressedFile);

			const recompressedBase64Size = getBase64Size(recompressedDataURL);
			console.log(`[Compression] Recompressed base64 size: ${formatBytes(recompressedBase64Size)}`);

			return recompressedDataURL;
		}

		return dataURL;
	} catch (error) {
		console.error("[Compression] Error compressing image:", error);
		throw error;
	}
}

/**
 * Compress any file (including non-images) if possible
 * For images: uses browser-image-compression
 * For other files: returns original if size is acceptable, otherwise throws error
 * @param file - The file to compress
 * @param maxSizeMB - Maximum size in MB (default: 1MB)
 * @returns Compressed file as data URL
 */
export async function compressFile(file: File, maxSizeMB: number = MAX_SIZE_MB): Promise<string> {
	const maxSizeBytes = maxSizeMB * 1024 * 1024;

	// For images, use image compression
	if (file.type.startsWith("image/")) {
		return compressImage(file, maxSizeMB);
	}

	// For non-images, convert to base64 and check size
	const dataURL = await fileToDataURL(file);
	const size = getBase64Size(dataURL);

	if (size <= maxSizeBytes) {
		console.log(
			`[Compression] File ${file.name} is within size limit: ${formatBytes(size)} / ${formatBytes(maxSizeBytes)}`,
		);
		return dataURL;
	}

	// Non-image files that are too large cannot be compressed easily
	const errorMessage = `File "${file.name}" is too large (${formatBytes(size)}) and cannot be compressed. Maximum size is ${formatBytes(maxSizeBytes)}.`;
	console.error(`[Compression] ${errorMessage}`);
	throw new Error(errorMessage);
}

/**
 * Check if file size (as base64) would exceed limit
 * @param file - The file to check
 * @param maxSizeMB - Maximum size in MB (default: 1MB)
 * @returns true if file would exceed limit, false otherwise
 */
export function willExceedSizeLimit(file: File, maxSizeMB: number = MAX_SIZE_MB): boolean {
	const maxSizeBytes = maxSizeMB * 1024 * 1024;
	const estimatedSize = estimateBase64Size(file.size);
	return estimatedSize > maxSizeBytes;
}

/**
 * Format bytes to human-readable string
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) return bytes + " B";
	if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
	return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

/**
 * Check if a file type is compressible (i.e., is an image)
 * @param fileType - MIME type of the file
 * @returns true if file type is compressible, false otherwise
 */
export function isCompressibleFileType(fileType: string): boolean {
	return fileType.startsWith("image/");
}
