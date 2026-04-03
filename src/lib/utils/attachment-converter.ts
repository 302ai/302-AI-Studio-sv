/* eslint-disable @typescript-eslint/no-explicit-any */
import { m } from "$lib/paraglide/messages.js";
import pdf2md from "@opendocsg/pdf2md";
import { createLogger } from "@shared/logger";
import type { AttachmentFile } from "@shared/types";
import type { FileUIPart } from "ai";
import mammoth from "mammoth";
import { toast } from "svelte-sonner";
import * as XLSX from "xlsx";
import { compressFile } from "./file-compressor";
import { officeMimeTypes } from "./file-preview";

const logger = createLogger("ui");

export type MessagePart = FileUIPart | { type: "text"; text: string };

export type AttachmentMetadata = {
	id: string;
	name: string;
	type: string;
	size: number;
	filePath: string;
	preview?: string;
	textContent?: string;
};

function isMediaFile(attachment: AttachmentFile): boolean {
	const mediaTypes = ["image/", "audio/", "video/"];
	return mediaTypes.some((type) => attachment.type.startsWith(type));
}

function isZipFile(attachment: AttachmentFile): boolean {
	const { type, name } = attachment;
	return (
		type === "application/zip" ||
		type === "application/x-zip-compressed" ||
		name.toLowerCase().endsWith(".zip")
	);
}

function isPdfFile(attachment: AttachmentFile): boolean {
	const { type, name } = attachment;
	return type === "application/pdf" || name.toLowerCase().endsWith(".pdf");
}

function isOfficeDocumentFile(attachment: AttachmentFile): boolean {
	const { type, name } = attachment;
	const lowerName = name.toLowerCase();

	if (officeMimeTypes.includes(type)) return true;

	// Check by file extension
	const officeExtensions = [".xlsx", ".xls", ".docx", ".doc", ".pptx", ".ppt"];
	return officeExtensions.some((ext) => lowerName.endsWith(ext));
}

function isTextFile(attachment: AttachmentFile): boolean {
	const { type, name } = attachment;

	if (type.startsWith("text/")) return true;

	const textExtensions = [
		".txt",
		".md",
		".markdown",
		".json",
		".jsonc",
		".xml",
		".html",
		".htm",
		".css",
		".scss",
		".sass",
		".less",
		".js",
		".ts",
		".tsx",
		".jsx",
		".py",
		".java",
		".cpp",
		".c",
		".h",
		".cs",
		".php",
		".rb",
		".go",
		".rs",
		".swift",
		".kt",
		".scala",
		".yml",
		".yaml",
		".toml",
		".ini",
		".cfg",
		".conf",
		".sh",
		".bat",
		".ps1",
		".sql",
		".log",
		".csv",
		".tsv",
		".vue",
		".svelte",
	];

	return textExtensions.some((ext) => name.toLowerCase().endsWith(ext));
}

/**
 * Get ArrayBuffer from attachment file or preview
 * Handles cases where File object may not have arrayBuffer method (e.g., after serialization)
 */
async function getArrayBufferFromAttachment(attachment: AttachmentFile): Promise<ArrayBuffer> {
	// First try to read from file if it has arrayBuffer method
	if (attachment.file && typeof attachment.file.arrayBuffer === "function") {
		return await attachment.file.arrayBuffer();
	}

	// Then try to read from preview (data URL or URL)
	if (attachment.preview && typeof attachment.preview === "string") {
		// Use fetch to decode data URL, blob URL, or regular URL
		// fetch() can handle all these URL types natively and correctly
		if (
			attachment.preview.startsWith("data:") ||
			attachment.preview.startsWith("blob:") ||
			attachment.preview.startsWith("http:") ||
			attachment.preview.startsWith("https:")
		) {
			const response = await fetch(attachment.preview);
			return await response.arrayBuffer();
		}
	}

	throw new Error("No file or preview available for parsing");
}

async function readPdfFile(attachment: AttachmentFile): Promise<string> {
	try {
		const arrayBuffer = await getArrayBufferFromAttachment(attachment);
		const uint8Array = new Uint8Array(arrayBuffer);

		// Parse PDF to Markdown using Uint8Array (browser-compatible)
		const markdown = await pdf2md(uint8Array);
		return markdown;
	} catch (error) {
		logger.error("Failed to parse PDF:", error);
		throw new Error(
			`Failed to parse PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

/**
 * Decode base64 string to UTF-8 text
 * Uses TextDecoder to properly handle multi-byte UTF-8 characters (e.g., Chinese)
 */

async function readTextFile(attachment: AttachmentFile): Promise<string> {
	// First try to read from file if it's a valid File object
	if (attachment.file && typeof attachment.file.text === "function") {
		return await attachment.file.text();
	}

	// Then try to read from preview using fetch (handles data URL, blob URL, etc.)
	if (attachment.preview && typeof attachment.preview === "string") {
		if (
			attachment.preview.startsWith("data:") ||
			attachment.preview.startsWith("blob:") ||
			attachment.preview.startsWith("http:") ||
			attachment.preview.startsWith("https:")
		) {
			const response = await fetch(attachment.preview);
			return await response.text();
		}
	}

	// Last resort: try to get ArrayBuffer and decode as text
	try {
		const arrayBuffer = await getArrayBufferFromAttachment(attachment);
		return new TextDecoder("utf-8").decode(arrayBuffer);
	} catch {
		// Ignore and throw the final error
	}

	throw new Error("No content available for text file");
}

async function readExcelFile(attachment: AttachmentFile): Promise<string> {
	try {
		const arrayBuffer = await getArrayBufferFromAttachment(attachment);

		// Parse Excel file
		const workbook = XLSX.read(arrayBuffer, { type: "array" });

		let content = "";

		// Process each sheet
		workbook.SheetNames.forEach((sheetName, index) => {
			const worksheet = workbook.Sheets[sheetName];

			// Convert sheet to CSV format (more readable than JSON)
			const csv = XLSX.utils.sheet_to_csv(worksheet);

			if (index > 0) content += "\n\n";
			content += `[${m.attachment_sheet()}: ${sheetName}]\n${csv}`;
		});

		return content;
	} catch (error) {
		logger.error("Failed to parse Excel file:", error);
		throw new Error(
			`Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

async function readWordFile(attachment: AttachmentFile): Promise<string> {
	try {
		const arrayBuffer = await getArrayBufferFromAttachment(attachment);

		// Extract text from Word document
		const result = await mammoth.extractRawText({ arrayBuffer });

		return result.value;
	} catch (error) {
		logger.error("Failed to parse Word document:", error);
		throw new Error(
			`Failed to parse Word document: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

export function createAttachmentMetadata(
	attachment: AttachmentFile,
	textContent?: string,
	preview?: string,
): AttachmentMetadata {
	return {
		id: attachment.id,
		name: attachment.name,
		type: attachment.type,
		size: attachment.size,
		filePath: attachment.filePath,
		preview: preview ?? attachment.preview,
		textContent,
	};
}

export async function convertAttachmentToMessagePart(
	attachment: AttachmentFile,
	enableZipSupport = false,
): Promise<{ part: MessagePart; textContent?: string; preview?: string }> {
	if (isMediaFile(attachment) || isZipFile(attachment)) {
		let url: string;

		// Prefer file object if it exists, to ensure fresh and correct data
		if (attachment.file && attachment.file instanceof File && attachment.file.size > 0) {
			url = await fileToDataURL(attachment.file);
		} else if (attachment.preview) {
			// If preview is a blob URL, convert it to base64
			if (attachment.preview.startsWith("blob:")) {
				try {
					const response = await fetch(attachment.preview);
					const blob = await response.blob();
					url = await new Promise((resolve, reject) => {
						const reader = new FileReader();
						reader.onload = () => resolve(reader.result as string);
						reader.onerror = reject;
						reader.readAsDataURL(blob);
					});
				} catch (error) {
					logger.error("Failed to convert blob URL to data URL:", error);
					// Fallback to filePath if blob fetch fails
					url = await fileToDataURL(attachment.file, attachment.filePath);
				}
			} else {
				url = attachment.preview;
			}
		} else {
			// For images, use compression to ensure base64 size < 1MB
			if (attachment.type.startsWith("image/")) {
				try {
					url = await compressFile(attachment.file);
				} catch (error) {
					logger.error(
						"[AttachmentConverter] Failed to compress image, using original:",
						error,
					);
					url = await fileToDataURL(attachment.file, attachment.filePath);
				}
			} else {
				// For audio/video/zip, use original (no compression)
				url = await fileToDataURL(attachment.file, attachment.filePath);
			}
		}

		return {
			part: {
				type: "file",
				mediaType:
					attachment.type ||
					(attachment.name.endsWith(".zip")
						? "application/zip"
						: "application/octet-stream"),
				filename: attachment.name,
				url,
			},
		};
	}

	// Handle PDF files - parse to markdown and treat as text
	if (isPdfFile(attachment)) {
		const content = await readPdfFile(attachment);

		return {
			part: {
				type: "text",
				text: `[File: ${attachment.name}]\n\`\`\`markdown\n${content}\n\`\`\``,
			},
			textContent: content,
		};
	}

	// Handle Office documents (xlsx, docx, pptx, etc.) - read and parse content
	if (isOfficeDocumentFile(attachment)) {
		const lowerName = attachment.name.toLowerCase();

		try {
			// Handle Excel files (.xlsx, .xls)
			if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
				const content = await readExcelFile(attachment);
				// Generate preview for message history (only if not already present)
				const preview =
					attachment.preview ||
					(attachment.file
						? await fileToDataURL(attachment.file, attachment.filePath)
						: undefined);
				return {
					part: {
						type: "text",
						text: `[File: ${attachment.name}]\n\`\`\`csv\n${content}\n\`\`\``,
					},
					textContent: content,
					preview,
				};
			}

			// Handle Word documents (.docx only - mammoth doesn't support .doc)
			if (lowerName.endsWith(".docx")) {
				const content = await readWordFile(attachment);
				// Generate preview for message history (only if not already present)
				const preview =
					attachment.preview ||
					(attachment.file
						? await fileToDataURL(attachment.file, attachment.filePath)
						: undefined);
				return {
					part: {
						type: "text",
						text: `[File: ${attachment.name}]\n\`\`\`\n${content}\n\`\`\``,
					},
					textContent: content,
					preview,
				};
			}

			// Handle old Word format (.doc) - not supported
			if (lowerName.endsWith(".doc")) {
				const sizeInKB = (attachment.size / 1024).toFixed(2);
				const description = `[${attachment.name}]\n${m.attachment_type()}: ${m.attachment_file_type_word()}\n${m.attachment_size()}: ${sizeInKB} KB\n\n${m.attachment_note()}: ${m.attachment_note_doc_not_supported()}`;

				return {
					part: {
						type: "text",
						text: description,
					},
				};
			}

			// Handle PowerPoint files (.pptx, .ppt) - not supported yet, show description
			if (lowerName.endsWith(".pptx") || lowerName.endsWith(".ppt")) {
				const sizeInKB = (attachment.size / 1024).toFixed(2);
				const description = `[${attachment.name}]\n${m.attachment_type()}: ${m.attachment_file_type_powerpoint()}\n${m.attachment_size()}: ${sizeInKB} KB\n\n${m.attachment_note()}: ${m.attachment_note_powerpoint_not_supported()}`;

				return {
					part: {
						type: "text",
						text: description,
					},
				};
			}
		} catch (error) {
			logger.error(`Failed to read Office document ${attachment.name}:`, error);
			toast.error(m.toast_attachment_convert_failed({ fileName: attachment.name }));
			// If parsing fails, return a description instead
			const sizeInKB = (attachment.size / 1024).toFixed(2);
			return {
				part: {
					type: "text",
					text: `[${attachment.name}]\n${m.attachment_size()}: ${sizeInKB} KB\n\n${m.attachment_note()}: ${m.attachment_note_cannot_read_content()}`,
				},
			};
		}
	}

	if (isTextFile(attachment)) {
		const content = await readTextFile(attachment);

		return {
			part: {
				type: "text",
				text: `[File: ${attachment.name}]\n\`\`\`\n${content}\n\`\`\``,
			},
			textContent: content,
		};
	}

	// Fallback for Agent Mode: allow any file type if zip support is enabled
	// This ensures that files with unknown MIME types (e.g. some ZIPs) are still sent
	if (enableZipSupport) {
		const url = await fileToDataURL(attachment.file, attachment.filePath);
		return {
			part: {
				type: "file",
				mediaType: attachment.type || "application/octet-stream",
				filename: attachment.name,
				url,
			},
		};
	}

	throw new Error(`Unsupported file type: ${attachment.type} (${attachment.name})`);
}

export async function convertAttachmentsToMessageParts(
	attachments: AttachmentFile[],
	options: { enableZipSupport?: boolean } = {},
): Promise<{ parts: MessagePart[]; metadataList: AttachmentMetadata[] }> {
	const parts: MessagePart[] = [];
	const metadataList: AttachmentMetadata[] = [];

	for (const attachment of attachments) {
		try {
			const { part, textContent, preview } = await convertAttachmentToMessagePart(
				attachment,
				options.enableZipSupport,
			);
			parts.push(part);
			metadataList.push(createAttachmentMetadata(attachment, textContent, preview));
		} catch (error) {
			logger.error(`Failed to convert attachment ${attachment.name}:`, error);
			toast.error(m.toast_attachment_convert_failed({ fileName: attachment.name }));
		}
	}

	return { parts, metadataList };
}

async function fileToDataURL(file: File, filePath?: string): Promise<string> {
	// 1. Try using FileReader (if file is a valid Blob/File)
	if (file instanceof Blob) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	// 2. If file is invalid, try using filePath via Electron
	if (filePath && window.electronAPI?.appService?.readFileAsBuffer) {
		try {
			const buffer = await window.electronAPI.appService.readFileAsBuffer(filePath);
			// Use the type from the file object (if available) or fallback to generic binary
			const type = (file as any).type || "application/octet-stream";

			// Convert ArrayBuffer to Base64
			let binary = "";
			const bytes = new Uint8Array(buffer);
			const len = bytes.byteLength;
			for (let i = 0; i < len; i++) {
				binary += String.fromCharCode(bytes[i]);
			}
			const base64 = window.btoa(binary);

			return `data:${type};base64,${base64}`;
		} catch (e) {
			logger.error("Failed to read file from path:", filePath, e);
		}
	}

	throw new Error("File object is invalid and cannot be read from path");
}
