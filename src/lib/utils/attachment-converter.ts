import type { FileUIPart } from "ai";
import type { AttachmentFile } from "@shared/types";

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
