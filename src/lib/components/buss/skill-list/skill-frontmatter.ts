import YAML from "yaml";

export type SkillFrontMatterData = Record<string, unknown>;

export interface ParsedSkillFrontMatter {
	data: SkillFrontMatterData;
	body: string;
}

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseSkillFrontMatter(content: string): ParsedSkillFrontMatter {
	const match = content.match(FRONTMATTER_REGEX);
	if (!match) {
		return { data: {}, body: content };
	}

	const [, yamlStr, body] = match;

	try {
		const parsed = YAML.parse(yamlStr);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return {
				data: parsed as SkillFrontMatterData,
				body,
			};
		}
	} catch (error) {
		console.warn("解析 skill frontmatter 失败", error);
	}

	return { data: {}, body };
}

export function stringifySkillFrontMatter(data: SkillFrontMatterData, body: string): string {
	const normalizedData = Object.fromEntries(
		Object.entries(data).filter(([, value]) => value !== undefined),
	);
	const yamlStr = YAML.stringify(normalizedData).trimEnd();

	return `---\n${yamlStr}\n---\n${body}`;
}

type TextFieldUpdates = Record<string, string>;

interface FrontMatterBlock {
	key: string;
	start: number;
	end: number;
	headerValue: string;
}

function parseFrontMatterBlocks(lines: string[]): FrontMatterBlock[] {
	const blocks: FrontMatterBlock[] = [];

	for (let i = 0; i < lines.length; i++) {
		const match = lines[i].match(/^([A-Za-z0-9_-]+):(.*)$/);
		if (!match) {
			continue;
		}

		let end = i;
		for (let j = i + 1; j < lines.length; j++) {
			if (/^[A-Za-z0-9_-]+:(?:\s|$)/.test(lines[j])) {
				break;
			}
			end = j;
		}

		blocks.push({
			key: match[1],
			start: i,
			end,
			headerValue: match[2].trim(),
		});
		i = end;
	}

	return blocks;
}

function renderTextField(key: string, value: string, style: "inline" | "next-line"): string[] {
	if (style === "next-line") {
		return [key + ":", ...value.split(/\r?\n/).map((line) => `  ${line}`)];
	}

	return [`${key}: ${value}`];
}

function inferTextFieldStyle(block: FrontMatterBlock, lines: string[]): "inline" | "next-line" {
	if (!block.headerValue && block.end > block.start) {
		const firstBodyLine = lines[block.start + 1]?.trimStart() ?? "";
		if (!firstBodyLine.startsWith("- ")) {
			return "next-line";
		}
	}

	return "inline";
}

export function updateSkillFrontMatterTextFields(
	content: string,
	updates: TextFieldUpdates,
): string {
	const match = content.match(FRONTMATTER_REGEX);
	if (!match) {
		return stringifySkillFrontMatter(updates, content);
	}

	const [, yamlStr, body] = match;
	const lines = yamlStr.split(/\r?\n/);
	const blocks = parseFrontMatterBlocks(lines);
	const pendingUpdates = new Map(Object.entries(updates));
	const resultLines: string[] = [];
	let lineIndex = 0;

	for (const block of blocks) {
		while (lineIndex < block.start) {
			resultLines.push(lines[lineIndex]);
			lineIndex++;
		}

		const nextValue = pendingUpdates.get(block.key);
		if (nextValue !== undefined) {
			const style = inferTextFieldStyle(block, lines);
			resultLines.push(...renderTextField(block.key, nextValue, style));
			pendingUpdates.delete(block.key);
		} else {
			for (let i = block.start; i <= block.end; i++) {
				resultLines.push(lines[i]);
			}
		}

		lineIndex = block.end + 1;
	}

	while (lineIndex < lines.length) {
		resultLines.push(lines[lineIndex]);
		lineIndex++;
	}

	for (const [key, value] of pendingUpdates) {
		resultLines.push(...renderTextField(key, value, "inline"));
	}

	return `---\n${resultLines.join("\n")}\n---\n${body}`;
}

export function getFrontMatterText(data: SkillFrontMatterData, key: string): string | undefined {
	const value = data[key];
	return typeof value === "string" ? value : undefined;
}
