import type { ChatMessage } from "$lib/types/chat";
import type { Resolvable } from "@ai-sdk/provider-utils";
import { resolve } from "@ai-sdk/provider-utils";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

export type HF = (options: {
	chatId: string;
	messages: ChatMessage[];
	body: Record<string, unknown>;
	headers: Record<string, string>;
	abortSignal?: AbortSignal;
	trigger: "submit-message" | "regenerate-message";
	messageId?: string;
	metadata?: unknown;
}) => Promise<ReadableStream<UIMessageChunk>>;

export type PrepareSendMessagesRequest<UI_MESSAGE extends UIMessage> = (options: {
	id: string;
	messages: UI_MESSAGE[];
	requestMetadata: unknown;
	body: Record<string, unknown> | undefined;
	headers: Record<string, string> | undefined;
	trigger: "submit-message" | "regenerate-message";
	messageId: string | undefined;
}) =>
	| {
			body: Record<string, unknown>;
			headers?: Record<string, string>;
	  }
	| PromiseLike<{
			body: Record<string, unknown>;
			headers?: Record<string, string>;
	  }>;

export type PrepareReconnectToStreamRequest = (options: {
	id: string;
	requestMetadata: unknown;
	body: Record<string, unknown> | undefined;
	headers: Record<string, string> | undefined;
}) =>
	| {
			headers?: Record<string, string>;
	  }
	| PromiseLike<{
			headers?: Record<string, string>;
	  }>;

export type FChatTransportOptions<UI_MESSAGE extends UIMessage> = {
	handler: HF | (() => HF);
	headers?: Resolvable<Record<string, string>>;
	body?: Resolvable<Record<string, unknown>>;
	prepareSendMessagesRequest?: PrepareSendMessagesRequest<UI_MESSAGE>;
	prepareReconnectToStreamRequest?: PrepareReconnectToStreamRequest;
};

export class FChatTransport<UI_MESSAGE extends ChatMessage> implements ChatTransport<UI_MESSAGE> {
	protected handler: HF | (() => HF);
	protected headers: FChatTransportOptions<UI_MESSAGE>["headers"];
	protected body: FChatTransportOptions<UI_MESSAGE>["body"];
	protected prepareSendMessagesRequest?: PrepareSendMessagesRequest<UI_MESSAGE>;
	protected prepareReconnectToStreamRequest?: PrepareReconnectToStreamRequest;

	constructor({
		handler,
		headers,
		body,
		prepareSendMessagesRequest,
		prepareReconnectToStreamRequest,
	}: FChatTransportOptions<UI_MESSAGE>) {
		this.handler = handler;
		this.headers = headers;
		this.body = body;
		this.prepareSendMessagesRequest = prepareSendMessagesRequest;
		this.prepareReconnectToStreamRequest = prepareReconnectToStreamRequest;
	}

	async sendMessages({
		abortSignal,
		headers: requestHeaders,
		body: requestBody,
		...options
	}: Parameters<ChatTransport<UI_MESSAGE>["sendMessages"]>[0]): Promise<
		ReadableStream<UIMessageChunk>
	> {
		const resolvedHeaders = await resolve(this.headers);
		const resolvedBody = await resolve(this.body);
		const mergedHeaders = {
			...resolvedHeaders,
			...(requestHeaders instanceof Headers
				? Object.fromEntries(requestHeaders.entries())
				: requestHeaders),
		};

		const mergedBody = {
			...resolvedBody,
			...(requestBody as Record<string, unknown>),
		};

		const preparedRequest = await this.prepareSendMessagesRequest?.({
			id: options.chatId,
			messages: options.messages,
			body: mergedBody,
			headers: mergedHeaders,
			requestMetadata: options.metadata,
			trigger: options.trigger,
			messageId: options.messageId,
		});

		const finalHeaders = preparedRequest?.headers ?? mergedHeaders;
		const finalBody = preparedRequest?.body ?? mergedBody;

		const resolvedHandler =
			typeof this.handler === "function" ? (this.handler as () => HF)() : (this.handler as HF);

		return await resolvedHandler({
			chatId: options.chatId,
			messages: options.messages,
			body: finalBody,
			headers: finalHeaders,
			abortSignal,
			trigger: options.trigger,
			messageId: options.messageId,
			metadata: options.metadata,
		});
	}

	async reconnectToStream(
		_options: Parameters<ChatTransport<UI_MESSAGE>["reconnectToStream"]>[0],
	): Promise<ReadableStream<UIMessageChunk> | null> {
		// TODO
		return null;
	}
}
