import type { AttachmentFile } from "$lib/stores/chat-state.svelte";
import {
	File,
	FileCode,
	FileImage,
	FileSpreadsheet,
	FileText,
	Headphones,
	Video,
	type IconProps,
} from "@lucide/svelte";
import type { Component } from "svelte";

export type ViewerType = "image" | "audio" | "video" | "code" | "document" | "text" | "unknown";

export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function getViewerType(attachment: AttachmentFile): ViewerType {
	const { type, name } = attachment;

	if (type.startsWith("image/")) {
		return "image";
	}

	if (type.startsWith("audio/")) {
		return "audio";
	}

	if (type.startsWith("video/")) {
		return "video";
	}

	if (
		type.includes("javascript") ||
		type.includes("typescript") ||
		name.endsWith(".js") ||
		name.endsWith(".ts") ||
		name.endsWith(".tsx") ||
		name.endsWith(".jsx") ||
		name.endsWith(".py") ||
		name.endsWith(".java") ||
		name.endsWith(".cpp") ||
		name.endsWith(".c") ||
		name.endsWith(".h") ||
		name.endsWith(".cs") ||
		name.endsWith(".php") ||
		name.endsWith(".rb") ||
		name.endsWith(".go") ||
		name.endsWith(".rs") ||
		name.endsWith(".swift") ||
		name.endsWith(".kt") ||
		name.endsWith(".scala") ||
		name.endsWith(".css") ||
		name.endsWith(".scss") ||
		name.endsWith(".sass") ||
		name.endsWith(".less") ||
		name.endsWith(".html") ||
		name.endsWith(".htm") ||
		name.endsWith(".xml") ||
		name.endsWith(".json") ||
		name.endsWith(".jsonc") ||
		name.endsWith(".yml") ||
		name.endsWith(".yaml") ||
		name.endsWith(".toml") ||
		name.endsWith(".ini") ||
		name.endsWith(".cfg") ||
		name.endsWith(".conf") ||
		name.endsWith(".sh") ||
		name.endsWith(".bat") ||
		name.endsWith(".ps1") ||
		name.endsWith(".sql") ||
		name.endsWith(".dockerfile") ||
		name.endsWith(".makefile") ||
		name.endsWith(".gradle") ||
		name.endsWith(".maven") ||
		name.endsWith(".r") ||
		name.endsWith(".m") ||
		name.endsWith(".dart") ||
		name.endsWith(".vue") ||
		name.endsWith(".svelte")
	) {
		return "code";
	}

	if (
		type.includes("pdf") ||
		type.includes("document") ||
		type.includes("word") ||
		type.includes("excel") ||
		type.includes("powerpoint") ||
		name.endsWith(".pdf") ||
		name.endsWith(".doc") ||
		name.endsWith(".docx") ||
		name.endsWith(".xlsx") ||
		name.endsWith(".xls") ||
		name.endsWith(".pptx") ||
		name.endsWith(".ppt")
	) {
		return "document";
	}

	if (
		type.startsWith("text/") ||
		name.endsWith(".txt") ||
		name.endsWith(".md") ||
		name.endsWith(".markdown") ||
		name.endsWith(".rst") ||
		name.endsWith(".log") ||
		name.endsWith(".csv") ||
		name.endsWith(".tsv") ||
		name.endsWith(".rtf")
	) {
		return "text";
	}

	return "unknown";
}

export function getFileIcon(attachment: AttachmentFile): Component<IconProps, object, ""> {
	const viewerType = getViewerType(attachment);

	const { type, name } = attachment;

	switch (viewerType) {
		case "image":
			return FileImage;
		case "audio":
			return Headphones;
		case "video":
			return Video;
		case "code":
			return FileCode;
		case "document": {
			if (
				type.includes("excel") ||
				type.includes("spreadsheet") ||
				type.includes("csv") ||
				name.endsWith(".xlsx") ||
				name.endsWith(".xls") ||
				name.endsWith(".csv")
			) {
				return FileSpreadsheet;
			}
			return FileText;
		}
		case "text":
			return FileText;
		case "unknown":
		default:
			return File;
	}
}

export async function loadTextContent(attachment: AttachmentFile): Promise<string> {
	if (attachment.preview && typeof attachment.preview === "string") {
		if (attachment.preview.startsWith("data:text/")) {
			const base64Content = attachment.preview.split(",")[1];
			return atob(base64Content);
		} else {
			const response = await fetch(attachment.preview);
			return await response.text();
		}
	} else if (attachment.file) {
		return await attachment.file.text();
	}
	throw new Error("No content available");
}
