export type messageStatus = "pending" | "success" | "error" | "stop";

export interface Provider {
	id: string;
	name: string;
}

export interface Model {
	id: string;
	provider: Provider;
	name: string;
	type: "llm" | "tts" | "text-embedding" | "rerank" | "speech-to-text";
}

export interface MCPServer {
	id: string;
}

export interface AttachmentFile {
	id: string;
	name: string;
	type: string;
	size: number;
	file: File;
	preview?: string;
	filePath: string;
}
