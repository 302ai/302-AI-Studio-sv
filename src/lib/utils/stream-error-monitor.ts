import type { ChatMessage, ChatTools, CustomUIDataTypes } from "$lib/types/chat";
import type { StreamTextResult } from "ai";
import { ChatErrorHandler } from "./error-handler";

export interface StreamMonitorOptions {
	provider: string;
	model: string;
	onStreamError?: (error: unknown) => void;
	onStreamAbort?: () => void;
	onToolError?: (error: unknown) => void;
}

export async function monitorStreamErrors(
	streamResult: StreamTextResult<ChatTools, CustomUIDataTypes>,
	originalMessages: ChatMessage[],
	options: StreamMonitorOptions,
) {
	const { provider, model, onStreamError, onStreamAbort, onToolError } = options;

	try {
		const { fullStream } = streamResult;

		const monitorPromise = (async () => {
			try {
				for await (const chunk of fullStream) {
					switch (chunk.type) {
						case "error": {
							const error = chunk.error;
							onStreamError?.(error);
							break;
						}

						case "abort": {
							ChatErrorHandler.handleError(
								"Stream was aborted",
								{
									provider,
									model,
									action: "stream_abort",
									retryable: false,
								},
								true,
							);
							onStreamAbort?.();
							break;
						}

						case "tool-error": {
							const error = chunk.error;
							ChatErrorHandler.handleError(
								error,
								{
									provider,
									model,
									action: "tool_error",
									retryable: true,
								},
								true,
							);
							onToolError?.(error);
							break;
						}

						default:
							break;
					}
				}
			} catch (error) {
				ChatErrorHandler.handleError(
					error,
					{
						provider,
						model,
						action: "stream_monitoring",
						retryable: true,
					},
					false,
				);
			}
		})();

		const uiStream = streamResult.toUIMessageStream({
			originalMessages,
			messageMetadata: () => ({
				model,
				provider,
				createdAt: new Date().toISOString(),
			}),
		});

		monitorPromise.catch((error) => {
			console.error("Stream monitor error:", error);
		});

		return uiStream;
	} catch (error) {
		ChatErrorHandler.handleError(
			error,
			{
				provider,
				model,
				action: "stream_setup",
				retryable: true,
			},
			true,
		);
		throw error;
	}
}
