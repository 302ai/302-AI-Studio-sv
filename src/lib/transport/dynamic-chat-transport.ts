import type { ChatMessage, ResultMetadata } from "$lib/types/chat";
import type { HttpChatTransportInitOptions } from "ai";
import { DefaultChatTransport } from "ai";

// Debug mode for transport layer logging (TRANS-01, TRANS-02, TRANS-03)
const DEBUG_TRANSPORT = import.meta.env.DEV;

// Store for pending result metadata (will be merged into message on finish)
export let pendingResultMetadata: ResultMetadata | null = null;

export function clearPendingResultMetadata() {
	pendingResultMetadata = null;
}

export type DynamicChatTransportOptions<UI_MESSAGE extends ChatMessage> = Omit<
	HttpChatTransportInitOptions<UI_MESSAGE>,
	"api"
> & {
	api: string | (() => string);
};

export class DynamicChatTransport<
	UI_MESSAGE extends ChatMessage,
> extends DefaultChatTransport<UI_MESSAGE> {
	private apiResolver: string | (() => string);

	constructor(options: DynamicChatTransportOptions<UI_MESSAGE>) {
		const { api, ...restOptions } = options;
		super({
			...restOptions,
			api: typeof api === "function" ? api() : api,
			fetch: async (input, init) => {
				// throw error when streming
				const response = await fetch(input, init);

				if (response.body) {
					const reader = response.body.getReader();
					const decoder = new TextDecoder();
					const encoder = new TextEncoder();
					const signal = init?.signal;

					const stream = new ReadableStream({
						async start(controller) {
							let buffer = "";

							// Listen for abort signal
							if (signal) {
								signal.addEventListener("abort", () => {
									console.log("[DynamicChatTransport] Abort signal received");
									reader.cancel();
									controller.close();
								});
							}

							try {
								while (true) {
									const { done, value } = await reader.read();
									if (done) {
										// TRANS-03: Connection close detection
										if (DEBUG_TRANSPORT) {
											console.log(
												"[DynamicChatTransport] Stream connection closed",
											);
										}
										if (buffer) {
											controller.enqueue(encoder.encode(buffer));
										}
										controller.close();
										break;
									}

									const chunk = decoder.decode(value, { stream: true });
									buffer += chunk;

									const lines = buffer.split("\n");
									buffer = lines.pop() || "";

									for (const line of lines) {
										// TRANS-01: Finish event detection logging
										if (DEBUG_TRANSPORT && line.includes('"type":"finish"')) {
											console.log(
												"[DynamicChatTransport] FINISH event received:",
												{
													timestamp: new Date().toISOString(),
													line: line.substring(0, 200),
												},
											);
										}

										// TRANS-02: [DONE] marker validation
										if (line.includes("[DONE]")) {
											if (DEBUG_TRANSPORT) {
												console.log(
													"[DynamicChatTransport] [DONE] marker received",
												);
											}
											// Forward [DONE] marker unchanged - critical for AI SDK stream termination
											controller.enqueue(encoder.encode(line + "\n"));
											continue;
										}

										// Handle message-metadata event (from 302.AI Claude Code result)
										if (line.includes('"type":"message-metadata"')) {
											try {
												const jsonStr = line.replace(/^data: /, "").trim();
												if (jsonStr) {
													const data = JSON.parse(jsonStr);
													if (
														data.type === "message-metadata" &&
														data.metadata
													) {
														console.log(
															"[DynamicChatTransport] Captured result metadata:",
															data.metadata,
														);
														// Store metadata for later use in onFinish
														pendingResultMetadata =
															data.metadata as ResultMetadata;
														// Don't forward this event to the stream
														continue;
													}
												}
											} catch (e) {
												console.error(
													"[DynamicChatTransport] Failed to parse message-metadata:",
													e,
												);
											}
										}

										if (line.includes('"type":"error"')) {
											try {
												// Extract the JSON part from "data: {...}"
												const jsonStr = line.replace(/^data: /, "").trim();
												if (jsonStr) {
													const data = JSON.parse(jsonStr);
													if (data.type === "error" && data.errorText) {
														console.warn(
															"[DynamicChatTransport] Captured deploy error into metadata:",
															data.errorText.slice(0, 200),
														);
														// Store error in metadata for auto-retry instead of showing in chat
														if (!pendingResultMetadata) {
															pendingResultMetadata =
																{} as ResultMetadata;
														}
														// eslint-disable-next-line @typescript-eslint/no-explicit-any
														(pendingResultMetadata as any).deployError =
															data.errorText;
														continue;
													}
												}
											} catch (e) {
												console.error(
													"[DynamicChatTransport] Failed to parse error line:",
													e,
												);
											}
										}
										controller.enqueue(encoder.encode(line + "\n"));
									}
								}
							} catch (error) {
								if (DEBUG_TRANSPORT) {
									console.error("[DynamicChatTransport] Stream error:", error);
								}
								controller.error(error);
							}
						},
					});

					return new Response(stream, {
						headers: response.headers,
						status: response.status,
						statusText: response.statusText,
					});
				}

				return response;
			},
		});
		this.apiResolver = api;
	}

	protected getApiUrl(): string {
		return typeof this.apiResolver === "function" ? this.apiResolver() : this.apiResolver;
	}

	async sendMessages(
		options: Parameters<DefaultChatTransport<UI_MESSAGE>["sendMessages"]>[0],
	): ReturnType<DefaultChatTransport<UI_MESSAGE>["sendMessages"]> {
		this.api = this.getApiUrl();
		return super.sendMessages(options);
	}

	async reconnectToStream(
		options: Parameters<DefaultChatTransport<UI_MESSAGE>["reconnectToStream"]>[0],
	): ReturnType<DefaultChatTransport<UI_MESSAGE>["reconnectToStream"]> {
		this.api = this.getApiUrl();
		return super.reconnectToStream(options);
	}
}
