import { m } from "$lib/paraglide/messages.js";
import pdf2md from "@opendocsg/pdf2md";
import type { AttachmentFile } from "@shared/types";
import type { FileUIPart } from "ai";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { compressFile } from "./file-compressor";

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

function isPdfFile(attachment: AttachmentFile): boolean {
	const { type, name } = attachment;
	return type === "application/pdf" || name.toLowerCase().endsWith(".pdf");
}

function isOfficeDocumentFile(attachment: AttachmentFile): boolean {
	const { type, name } = attachment;
	const lowerName = name.toLowerCase();

	// Check by MIME type
	const officeMimeTypes = [
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
		"application/vnd.ms-excel", // .xls
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
		"application/msword", // .doc
		"application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
		"application/vnd.ms-powerpoint", // .ppt
	];

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

async function readPdfFile(attachment: AttachmentFile): Promise<string> {
	try {
		if (!attachment.file) {
			throw new Error("No file available for PDF parsing");
		}

		// Convert File to ArrayBuffer (browser-compatible)
		const arrayBuffer = await attachment.file.arrayBuffer();
		const uint8Array = new Uint8Array(arrayBuffer);

		// Parse PDF to Markdown using Uint8Array (browser-compatible)
		const markdown = await pdf2md(uint8Array);
		return markdown;
	} catch (error) {
		console.error("Failed to parse PDF:", error);
		throw new Error(
			`Failed to parse PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

async function readTextFile(attachment: AttachmentFile): Promise<string> {
	if (attachment.file) {
		return await attachment.file.text();
	}

	if (attachment.preview && typeof attachment.preview === "string") {
		if (attachment.preview.startsWith("data:text/")) {
			const base64Content = attachment.preview.split(",")[1];
			return atob(base64Content);
		} else {
			const response = await fetch(attachment.preview);
			return await response.text();
		}
	}

	throw new Error("No content available for text file");
}

async function readExcelFile(attachment: AttachmentFile): Promise<string> {
	try {
		if (!attachment.file) {
			throw new Error("No file available for Excel parsing");
		}

		// Read file as ArrayBuffer
		const arrayBuffer = await attachment.file.arrayBuffer();

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
		console.error("Failed to parse Excel file:", error);
		throw new Error(
			`Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

async function readWordFile(attachment: AttachmentFile): Promise<string> {
	try {
		if (!attachment.file) {
			throw new Error("No file available for Word parsing");
		}

		// Read file as ArrayBuffer
		const arrayBuffer = await attachment.file.arrayBuffer();

		// Extract text from Word document
		const result = await mammoth.extractRawText({ arrayBuffer });

		return result.value;
	} catch (error) {
		console.error("Failed to parse Word document:", error);
		throw new Error(
			`Failed to parse Word document: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

export function createAttachmentMetadata(
	attachment: AttachmentFile,
	textContent?: string,
): AttachmentMetadata {
	return {
		id: attachment.id,
		name: attachment.name,
		type: attachment.type,
		size: attachment.size,
		filePath: attachment.filePath,
		preview: attachment.preview,
		textContent,
	};
}

export async function convertAttachmentToMessagePart(
	attachment: AttachmentFile,
): Promise<{ part: MessagePart; textContent?: string }> {
	if (isMediaFile(attachment)) {
		let url: string;

		if (attachment.preview) {
			url = attachment.preview;
		} else {
			// For images, use compression to ensure base64 size < 1MB
			if (attachment.type.startsWith("image/")) {
				try {
					url = await compressFile(attachment.file);
				} catch (error) {
					console.error("[AttachmentConverter] Failed to compress image, using original:", error);
					url = await fileToDataURL(attachment.file);
				}
			} else {
				// For audio/video, use original (no compression)
				url = await fileToDataURL(attachment.file);
			}
		}

		return {
			part: {
				type: "file",
				mediaType: attachment.type,
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
				return {
					part: {
						type: "text",
						text: `[File: ${attachment.name}]\n\`\`\`csv\n${content}\n\`\`\``,
					},
					textContent: content,
				};
			}

			// Handle Word documents (.docx, .doc)
			if (lowerName.endsWith(".docx") || lowerName.endsWith(".doc")) {
				const content = await readWordFile(attachment);
				return {
					part: {
						type: "text",
						text: `[File: ${attachment.name}]\n\`\`\`\n${content}\n\`\`\``,
					},
					textContent: content,
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
			console.error(`Failed to read Office document ${attachment.name}:`, error);
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

	throw new Error(`Unsupported file type: ${attachment.type} (${attachment.name})`);
}

export async function convertAttachmentsToMessageParts(
	attachments: AttachmentFile[],
): Promise<{ parts: MessagePart[]; metadataList: AttachmentMetadata[] }> {
	const parts: MessagePart[] = [];
	const metadataList: AttachmentMetadata[] = [];

	for (const attachment of attachments) {
		try {
			const { part, textContent } = await convertAttachmentToMessagePart(attachment);
			parts.push(part);
			metadataList.push(createAttachmentMetadata(attachment, textContent));
		} catch (error) {
			console.error(`Failed to convert attachment ${attachment.name}:`, error);
		}
	}

	return { parts, metadataList };
}

async function fileToDataURL(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}
