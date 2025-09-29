import * as m from "$lib/paraglide/messages.js";
import { toast } from "svelte-sonner";

export interface ErrorContext {
	provider?: string;
	model?: string;
	action?: string;
	retryable?: boolean;
}

export enum ErrorType {
	NETWORK = "network",
	API = "api",
	AUTHENTICATION = "authentication",
	STREAMING = "streaming",
	RATE_LIMIT = "rate_limit",
	UNKNOWN = "unknown",
}

export interface ChatError {
	type: ErrorType;
	message: string;
	originalError: unknown;
	context?: ErrorContext;
	statusCode?: number;
	retryAfter?: number;
}

export class ChatErrorHandler {
	private static getErrorType(error: unknown): ErrorType {
		if (!error) return ErrorType.UNKNOWN;

		if (error instanceof Response) {
			const status = error.status;
			if (status === 401 || status === 403) return ErrorType.AUTHENTICATION;
			if (status === 429) return ErrorType.RATE_LIMIT;
			if (status >= 500) return ErrorType.API;
			if (status >= 400) return ErrorType.API;
			return ErrorType.NETWORK;
		}

		if (error instanceof Error) {
			const message = error.message.toLowerCase();
			if (message.includes("network") || message.includes("fetch")) {
				return ErrorType.NETWORK;
			}
			if (message.includes("unauthorized") || message.includes("forbidden")) {
				return ErrorType.AUTHENTICATION;
			}
			if (message.includes("rate limit") || message.includes("too many")) {
				return ErrorType.RATE_LIMIT;
			}
			if (message.includes("stream") || message.includes("abort")) {
				return ErrorType.STREAMING;
			}
			return ErrorType.API;
		}

		if (typeof error === "object" && error !== null) {
			const errorObj = error as Record<string, unknown>;
			if (typeof errorObj.name === "string" && errorObj.name.includes("APICallError"))
				return ErrorType.API;
			if (typeof errorObj.name === "string" && errorObj.name.includes("TooManyRequestsError"))
				return ErrorType.RATE_LIMIT;
			if (typeof errorObj.name === "string" && errorObj.name.includes("InvalidResponseDataError"))
				return ErrorType.API;
		}

		return ErrorType.UNKNOWN;
	}

	private static getRetryAfter(error: unknown): number | undefined {
		if (error instanceof Response) {
			const retryAfter = error.headers.get("retry-after");
			if (retryAfter) {
				const seconds = parseInt(retryAfter, 10);
				return isNaN(seconds) ? undefined : seconds * 1000;
			}
		}

		if (typeof error === "object" && error !== null) {
			const errorObj = error as Record<string, unknown>;
			if (typeof errorObj.retryAfter === "number") {
				return errorObj.retryAfter;
			}
		}

		return undefined;
	}

	private static getUserFriendlyMessage(chatError: ChatError): string {
		const { type, context } = chatError;
		const provider = context?.provider || m.ai_service();

		switch (type) {
			case ErrorType.NETWORK:
				return m.error_network_connection_failed();

			case ErrorType.AUTHENTICATION:
				return m.error_authentication_failed({ provider });

			case ErrorType.RATE_LIMIT: {
				const waitTime = chatError.retryAfter
					? m.error_rate_limit_wait_seconds({
							seconds: Math.ceil(chatError.retryAfter / 1000).toString(),
						})
					: m.error_rate_limit_wait_moment();
				return m.error_rate_limit_exceeded({ provider, waitTime });
			}

			case ErrorType.STREAMING:
				return m.error_stream_interrupted();

			case ErrorType.API:
				if (chatError.statusCode) {
					return m.error_api_with_code({ provider, statusCode: chatError.statusCode.toString() });
				}
				return m.error_api_service({ provider });

			case ErrorType.UNKNOWN:
			default:
				return m.error_unexpected_occurred();
		}
	}

	static createError(error: unknown, context?: ErrorContext): ChatError {
		const type = this.getErrorType(error);
		const retryAfter = this.getRetryAfter(error);
		const statusCode = error instanceof Response ? error.status : undefined;

		let message = "Unknown error";
		if (error instanceof Error) {
			message = error.message;
		} else if (typeof error === "string") {
			message = error;
		} else if (error instanceof Response) {
			message = `HTTP ${error.status}: ${error.statusText}`;
		}

		return {
			type,
			message,
			originalError: error,
			context,
			statusCode,
			retryAfter,
		};
	}

	static handleError(error: unknown, context?: ErrorContext, showNotification = true): ChatError {
		const chatError = this.createError(error, context);
		if (showNotification) {
			this.showErrorNotification(chatError);
		}
		console.error("Chat error:", chatError);
		return chatError;
	}

	static showErrorNotification(chatError: ChatError): void {
		const message = this.getUserFriendlyMessage(chatError);
		const { type } = chatError;

		switch (type) {
			case ErrorType.AUTHENTICATION:
				toast.error(message, {
					action: {
						label: "Settings",
						onClick: () => {
							window.location.href = "/settings/providers";
						},
					},
					duration: 10000,
				});
				break;

			case ErrorType.RATE_LIMIT:
				toast.warning(message, {
					duration: chatError.retryAfter || 8000,
				});
				break;

			case ErrorType.NETWORK:
				toast.error(message, {
					duration: 8000,
				});
				break;

			case ErrorType.STREAMING:
				toast.info(message, {
					duration: 5000,
				});
				break;

			case ErrorType.API:
			case ErrorType.UNKNOWN:
			default:
				toast.error(message, {
					duration: 8000,
				});
				break;
		}
	}

	static isRetryable(chatError: ChatError): boolean {
		const { type } = chatError;
		return (
			[ErrorType.NETWORK, ErrorType.RATE_LIMIT, ErrorType.API].includes(type) &&
			chatError.statusCode !== 401 &&
			chatError.statusCode !== 403
		);
	}

	static getRetryDelay(chatError: ChatError): number {
		if (chatError.retryAfter) {
			return chatError.retryAfter;
		}

		switch (chatError.type) {
			case ErrorType.RATE_LIMIT:
				return 5000;
			case ErrorType.NETWORK:
				return 2000;
			case ErrorType.API:
				return 3000;
			default:
				return 1000;
		}
	}
}
