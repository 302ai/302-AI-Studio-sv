export interface ReplaceCodeBlockOptions {
	code: string;
	language?: string | null;
	meta?: string | null;
}

const CODE_FENCE_REGEX = /^(`{3,}|~{3,})(.*)$/;

const splitLines = (content: string): string[] => content.split(/\r?\n/);

const joinLines = (lines: string[]): string => lines.join("\n");

const buildInfoLine = (fence: string, language?: string | null, meta?: string | null): string => {
	const normalizedLanguage = language ?? "";
	const normalizedMeta = meta?.trim() ?? "";
	const segments = [normalizedLanguage.trim(), normalizedMeta].filter(
		(segment) => segment.length > 0,
	);
	return segments.length > 0 ? `${fence} ${segments.join(" ")}` : fence;
};

interface BlockLocator {
	start: number;
	end: number;
	fence: string;
	info: string;
}

const findCodeBlock = (lines: string[], targetIndex: number): BlockLocator | null => {
	let currentIndex = -1;
	let fence = "";
	let start = -1;
	let info = "";

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
		const line = lines[lineIndex];
		if (!fence) {
			const match = line.match(CODE_FENCE_REGEX);
			if (match) {
				currentIndex += 1;
				const [, detectedFence, infoPart = ""] = match;
				fence = detectedFence;
				start = lineIndex;
				info = infoPart.trim();
				if (currentIndex === targetIndex) {
					continue;
				}
			}
		} else if (line.startsWith(fence)) {
			if (currentIndex === targetIndex) {
				return {
					start,
					end: lineIndex,
					fence,
					info,
				};
			}
			fence = "";
			start = -1;
			info = "";
		}
	}

	return null;
};

export const replaceCodeBlockAt = (
	markdown: string,
	blockIndex: number,
	options: ReplaceCodeBlockOptions,
): string | null => {
	if (blockIndex < 0) {
		return null;
	}

	const lines = splitLines(markdown);
	const block = findCodeBlock(lines, blockIndex);
	if (!block) {
		return null;
	}

	const { start, end, fence } = block;
	const originalInfo = block.info;
	const [existingLanguage = "", ...restMeta] = originalInfo.split(/\s+/).filter(Boolean);
	const existingMeta = restMeta.join(" ");

	const nextLanguage =
		options.language === undefined
			? existingLanguage
			: options.language === null
				? ""
				: options.language;
	const nextMeta = options.meta ?? existingMeta;

	const before = lines.slice(0, start);
	const after = lines.slice(end + 1);
	const replacementLines = splitLines(options.code.replace(/\r?\n/g, "\n"));

	const infoLine = buildInfoLine(fence, nextLanguage, nextMeta);
	const closingFence = fence;

	return joinLines([...before, infoLine, ...replacementLines, closingFence, ...after]);
};
