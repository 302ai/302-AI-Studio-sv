export class DeployRetryState {
	#retryCount = 0;
	#lastApiError: string | null = null;

	constructor(readonly maxRetryCount: number) {}

	get retryCount(): number {
		return this.#retryCount;
	}

	canRetry(): boolean {
		return this.#retryCount < this.maxRetryCount;
	}

	incrementRetry(): number {
		this.#retryCount++;
		return this.#retryCount;
	}

	recordApiError(error: string): void {
		this.#lastApiError = error;
	}

	consumeApiError(): string | null {
		const error = this.#lastApiError;
		this.#lastApiError = null;
		return error;
	}

	reset(): void {
		this.#retryCount = 0;
		this.#lastApiError = null;
	}
}
