export interface GeneratedTitleResult {
	title: string;
	summary: string;
}

const reasoningBlockPattern = /<(think|thinking|reason|reasoning)>[\s\S]*?<\/\1>/gi;
const unclosedReasoningPattern = /<(think|thinking|reason|reasoning)>[\s\S]*/gi;

export function sanitizeTitleGenerationText(rawText: string | undefined): string {
	if (!rawText) {
		return "";
	}

	let sanitized = rawText.trim();
	sanitized = sanitized.replace(reasoningBlockPattern, "");
	sanitized = sanitized.replace(unclosedReasoningPattern, "");
	sanitized = sanitized.trim();

	if (sanitized.startsWith("```")) {
		sanitized = sanitized.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
	}

	return sanitized.trim();
}

export function parseGeneratedTitleContent(
	rawText: string,
	fallbackSummary = "",
): GeneratedTitleResult {
	const sanitized = sanitizeTitleGenerationText(rawText);
	const sanitizedFallbackSummary = sanitizeTitleGenerationText(fallbackSummary);

	try {
		const parsed = JSON.parse(sanitized) as Partial<GeneratedTitleResult>;
		return normalizeGeneratedTitleResult({
			title: typeof parsed.title === "string" ? parsed.title : "",
			summary: typeof parsed.summary === "string" ? parsed.summary : sanitizedFallbackSummary,
		});
	} catch {
		const normalized = normalizeGeneratedTitleResult({
			title: sanitized,
			summary: "",
		});

		return {
			title: normalized.title,
			summary: normalized.summary || sanitizedFallbackSummary,
		};
	}
}

export function normalizeGeneratedTitleResult(
	result: Partial<GeneratedTitleResult>,
): GeneratedTitleResult {
	const sanitizedTitle = sanitizeTitleGenerationText(result.title);
	const sanitizedSummary = sanitizeTitleGenerationText(result.summary);
	const extracted = extractStructuredFields(sanitizedTitle);

	let title = extracted.title || sanitizedTitle;
	let summary = sanitizedSummary || extracted.summary || "";

	if (title && title !== sanitizedTitle) {
		const nested = extractStructuredFields(title);
		title = nested.title || title;
		summary = summary || nested.summary || "";
	}

	return {
		title: cleanupScalarValue(title),
		summary: cleanupScalarValue(summary),
	};
}

function extractStructuredFields(rawText: string): Partial<GeneratedTitleResult> {
	if (!looksLikeStructuredPayload(rawText)) {
		return {};
	}

	try {
		const parsed = JSON.parse(rawText) as Partial<GeneratedTitleResult>;
		return {
			title: typeof parsed.title === "string" ? cleanupScalarValue(parsed.title) : "",
			summary: typeof parsed.summary === "string" ? cleanupScalarValue(parsed.summary) : "",
		};
	} catch {
		return {
			title: extractFieldValue(rawText, "title"),
			summary: extractFieldValue(rawText, "summary"),
		};
	}
}

function looksLikeStructuredPayload(rawText: string): boolean {
	return (
		rawText.startsWith("{") ||
		/["']title["']\s*:/i.test(rawText) ||
		/["']summary["']\s*:/i.test(rawText)
	);
}

function extractFieldValue(rawText: string, field: "title" | "summary"): string {
	const doubleQuoted = rawText.match(
		new RegExp(`["']${field}["']\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "i"),
	);
	if (doubleQuoted?.[1]) {
		return decodeQuotedValue(doubleQuoted[1]);
	}

	const singleQuoted = rawText.match(
		new RegExp(`["']${field}["']\\s*:\\s*'((?:\\\\.|[^'\\\\])*)'`, "i"),
	);
	if (singleQuoted?.[1]) {
		return decodeQuotedValue(singleQuoted[1]);
	}

	const unquoted = rawText.match(new RegExp(`["']${field}["']\\s*:\\s*([^,}\\n]+)`, "i"));
	return cleanupScalarValue(unquoted?.[1] || "");
}

function decodeQuotedValue(rawText: string): string {
	try {
		return cleanupScalarValue(
			JSON.parse(`"${rawText.replace(/\r/g, "\\r").replace(/\n/g, "\\n")}"`) as string,
		);
	} catch {
		return cleanupScalarValue(rawText);
	}
}

function cleanupScalarValue(rawText: string): string {
	let cleaned = sanitizeTitleGenerationText(rawText).trim();

	if (
		(cleaned.startsWith('"') && cleaned.endsWith('"')) ||
		(cleaned.startsWith("'") && cleaned.endsWith("'"))
	) {
		cleaned = cleaned.slice(1, -1).trim();
	}

	return cleaned;
}
