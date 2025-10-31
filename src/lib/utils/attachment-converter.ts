import pdf2md from "@opendocsg/pdf2md";
import type { AttachmentFile } from "@shared/types";
import type { FileUIPart } from "ai";

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
			url = await fileToDataURL(attachment.file);
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
