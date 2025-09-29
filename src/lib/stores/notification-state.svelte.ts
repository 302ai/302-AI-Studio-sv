import type { ChatError } from "$lib/utils/error-handler";

export interface NotificationState {
	lastError: ChatError | null;
	retryCount: number;
	maxRetries: number;
}

class NotificationStateManager {
	private state = $state<NotificationState>({
		lastError: null,
		retryCount: 0,
		maxRetries: 3,
	});

	get lastError(): ChatError | null {
		return this.state.lastError;
	}

	get retryCount(): number {
		return this.state.retryCount;
	}

	get maxRetries(): number {
		return this.state.maxRetries;
	}

	get canRetry(): boolean {
		return this.state.retryCount < this.state.maxRetries && this.state.lastError !== null;
	}

	setError(error: ChatError): void {
		this.state.lastError = error;
	}

	incrementRetryCount(): void {
		this.state.retryCount++;
	}

	resetRetryCount(): void {
		this.state.retryCount = 0;
	}

	clearError(): void {
		this.state.lastError = null;
		this.state.retryCount = 0;
	}

	setMaxRetries(maxRetries: number): void {
		this.state.maxRetries = Math.max(0, maxRetries);
	}
}

export const notificationState = new NotificationStateManager();
