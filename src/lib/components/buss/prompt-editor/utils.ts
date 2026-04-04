import type { SerializedEditorState, SerializedParagraphNode, SerializedTextNode } from "lexical";
import type { SerializedVariableValueNode } from "./nodes/variable-value-node";

// Variable pattern regex: {{#variable#}}
const VARIABLE_PATTERN = /\{\{#([^#}]+)#\}\}/g;

type SerializedCustomTextNode = SerializedTextNode & { type: "custom-text" };

/**
 * Check if the input is already a valid Lexical editor state JSON
 */
export function isLexicalEditorState(text: string): boolean {
	try {
		const parsed = JSON.parse(text);
		return (
			parsed && typeof parsed === "object" && "root" in parsed && parsed.root?.type === "root"
		);
	} catch {
		return false;
	}
}

/**
 * Convert a text string with variable placeholders to Lexical editor state JSON
 * If the input is already a valid Lexical editor state JSON, return it as-is
 */
export function textJsonToEditorState(text: string | null): string | null {
	if (!text) return null;

	// If already a valid Lexical editor state, return as-is
	if (isLexicalEditorState(text)) {
		return text;
	}

	const paragraphs: SerializedParagraphNode[] = [];
	const lines = text.split("\n");

	for (const line of lines) {
		const children: (SerializedCustomTextNode | SerializedVariableValueNode)[] = [];
		let lastIndex = 0;
		let match: RegExpExecArray | null;

		// Reset regex state
		VARIABLE_PATTERN.lastIndex = 0;

		while ((match = VARIABLE_PATTERN.exec(line)) !== null) {
			// Add text before the variable
			if (match.index > lastIndex) {
				const textBefore = line.slice(lastIndex, match.index);
				const textNode: SerializedCustomTextNode = {
					detail: 0,
					format: 0,
					mode: "normal",
					style: "",
					text: textBefore,
					type: "custom-text",
					version: 1,
				};
				children.push(textNode);
			}

			// Add variable node
			const variableNode: SerializedVariableValueNode = {
				type: "variable-value",
				version: 1,
				variable: match[1],
			};
			children.push(variableNode);

			lastIndex = match.index + match[0].length;
		}

		// Add remaining text after last variable
		if (lastIndex < line.length) {
			const textAfter = line.slice(lastIndex);
			const textNode: SerializedCustomTextNode = {
				detail: 0,
				format: 0,
				mode: "normal",
				style: "",
				text: textAfter,
				type: "custom-text",
				version: 1,
			};
			children.push(textNode);
		}

		// If line is empty, add an empty paragraph
		if (children.length === 0) {
			const emptyTextNode: SerializedCustomTextNode = {
				detail: 0,
				format: 0,
				mode: "normal",
				style: "",
				text: "",
				type: "custom-text",
				version: 1,
			};
			children.push(emptyTextNode);
		}

		paragraphs.push({
			children,
			direction: "ltr",
			format: "",
			indent: 0,
			type: "paragraph",
			version: 1,
			textFormat: 0,
			textStyle: "",
		} as SerializedParagraphNode);
	}

	const editorState: SerializedEditorState = {
		root: {
			children: paragraphs,
			direction: "ltr",
			format: "",
			indent: 0,
			type: "root",
			version: 1,
		},
	};

	return JSON.stringify(editorState);
}

/**
 * Convert Lexical editor state to text with variable placeholders
 */
export function editorStateToText(editorState: SerializedEditorState): string {
	const lines: string[] = [];

	for (const paragraph of editorState.root.children) {
		if (paragraph.type === "paragraph") {
			const paragraphNode = paragraph as SerializedParagraphNode;
			let lineText = "";

			for (const child of paragraphNode.children) {
				if (child.type === "variable-value") {
					const variableNode = child as SerializedVariableValueNode;
					lineText += `{{#${variableNode.variable}#}}`;
				} else if ("text" in child) {
					lineText += (child as { text: string }).text;
				}
			}

			lines.push(lineText);
		}
	}

	return lines.join("\n");
}

/**
 * Check if text contains double brace trigger
 */
export function triggerMatchForDoubleBrace(text: string): {
	leadOffset: number;
	matchingString: string;
	replaceableString: string;
} | null {
	const triggerIndex = text.lastIndexOf("{{");
	if (triggerIndex === -1) return null;

	const afterTrigger = text.slice(triggerIndex + 2);
	// Check if there's a closing brace, which means it's already completed
	if (afterTrigger.includes("}}")) return null;

	return {
		leadOffset: triggerIndex,
		matchingString: afterTrigger,
		replaceableString: text.slice(triggerIndex),
	};
}
