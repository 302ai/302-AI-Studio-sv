import type { ChatMessage } from "$lib/types/chat";
import type { HttpChatTransportInitOptions } from "ai";
import { DefaultChatTransport } from "ai";

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
