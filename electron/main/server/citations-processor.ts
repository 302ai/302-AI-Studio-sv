interface SSEData {
	choices?: Array<{
		delta?: {
			content?: string;
		};
		finish_reason?: string;
	}>;
	citations?: string[];
}

interface DeltaContent {
	content?: string;
}

interface Choice {
	delta?: DeltaContent;
	finish_reason?: string;
}

export function createCitationsFetch(): typeof fetch {
	return async (url, options) => {
		const response = await fetch(url, options);
		const citationsProcessor = new CitationsProcessor();
		return interceptSSEResponse(response, citationsProcessor);
	};
}

export function interceptSSEResponse(response: Response, processor: CitationsProcessor): Response {
	const clonedResponse = response.clone();
	const contentType = response.headers.get("content-type");

	if (contentType?.includes("text/event-stream")) {
		const originalStream = clonedResponse.body;
		if (originalStream) {
			const reader = originalStream.getReader();
			const decoder = new TextDecoder();

			const interceptedStream = new ReadableStream({
				start: (controller) => {
					const pump = (): Promise<void> => {
						return reader.read().then(({ done, value }) => {
							if (done) {
								const finalChunk = processor.flushBuffer();
								if (finalChunk) {
									const encoder = new TextEncoder();
									const finalValue = encoder.encode(finalChunk);
									controller.enqueue(finalValue);
								}
								controller.close();
								return;
							}

							const chunk = decoder.decode(value, { stream: true });
							const processedChunk = processor.processSSEChunk(chunk);
							if (processedChunk) {
								const encoder = new TextEncoder();
								const processedValue = encoder.encode(processedChunk);
								controller.enqueue(processedValue);
							}
							return pump();
						});
					};
					return pump();
				},
			});

			return new Response(interceptedStream, {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
			});
		}
	}

	return response;
}

class CitationsProcessor {
	private citations: string[] = [];
	private hasAddedCitations = false;
	private buffer = "";

	processSSEChunk(chunk: string): string {
		this.buffer += chunk;

		const lines = this.buffer.split("\n");
		const processedLines: string[] = [];
		const hasIncompleteLastLine = !this.buffer.endsWith("\n");
		const linesToProcess = hasIncompleteLastLine ? lines.slice(0, -1) : lines;

		this.buffer = hasIncompleteLastLine ? (lines.at(-1) ?? "") : "";

		for (const line of linesToProcess) {
			processedLines.push(this.processLine(line));
		}

		return processedLines.length > 0 ? `${processedLines.join("\n")}\n` : "";
	}

	private processLine(line: string): string {
		if (!line.startsWith("data: ")) {
			let data: { error?: { message: string } };
			try {
				data = JSON.parse(line);
			} catch (_error) {
				return line;
			}

			if (data?.error) {
				throw new Error(data.error.message);
			}

			return line;
		}

		const jsonStr = line.substring(6);

		if (this.isDoneMessage(jsonStr)) {
			return line;
		}

		try {
			const data = JSON.parse(jsonStr) as SSEData;
			this.extractCitations(data);
			this.addCitationsIfNeeded(data);

			return `data: ${JSON.stringify(data)}`;
		} catch {
			return line;
		}
	}

	private isDoneMessage(jsonStr: string): boolean {
		return jsonStr.trim() === "[DONE]";
	}

	private extractCitations(data: SSEData): void {
		const citations = data.citations;
		if (this.citations.length === 0 && citations && citations.length > 0) {
			this.citations = citations;
		}
	}

	private addCitationsIfNeeded(data: SSEData): void {
		const choice = this.getFirstChoice(data);

		if (!this.shouldAddCitations(choice)) return;

		const delta = choice?.delta;
		const existingContent = delta?.content || "";
		const citationsText = this.formatCitations();

		if (choice && delta) {
			delta.content = existingContent + citationsText;
			this.hasAddedCitations = true;
		} else if (choice) {
			choice.delta = { content: citationsText };
			this.hasAddedCitations = true;
		}
	}

	private shouldAddCitations(choice: Choice | undefined): boolean {
		if (!choice) return false;

		return choice.finish_reason === "stop" && this.citations.length > 0 && !this.hasAddedCitations;
	}

	private getFirstChoice(data: SSEData): Choice | undefined {
		const choices = data.choices;
		return choices && choices.length > 0 ? choices[0] : undefined;
	}

	private formatCitations(): string {
		if (this.citations.length === 0) {
			return "";
		}

		const citationLines = this.citations.map((citation, index) => `- [${index + 1}] ${citation}`);

		return `\n\n${citationLines.join("\n")}\n`;
	}

	flushBuffer(): string {
		if (this.buffer.trim() === "") return "";

		const finalLine = this.processLine(this.buffer);
		this.buffer = "";
		return `${finalLine}\n`;
	}
}

export { CitationsProcessor };
