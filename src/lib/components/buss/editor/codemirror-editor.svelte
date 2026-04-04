<script lang="ts">
	import type { ShikiHighlighter } from "$lib/components/buss/markdown/highlighter";
	import { ensureHighlighter } from "$lib/components/buss/markdown/highlighter";
	import { css } from "@codemirror/lang-css";
	import { html } from "@codemirror/lang-html";
	import { javascript } from "@codemirror/lang-javascript";
	import { json } from "@codemirror/lang-json";
	import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
	import { python } from "@codemirror/lang-python";
	import { xml } from "@codemirror/lang-xml";
	import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
	import { languages } from "@codemirror/language-data";
	import { Compartment, EditorState, type Extension } from "@codemirror/state";
	import { tags } from "@lezer/highlight";
	import { basicSetup, EditorView } from "codemirror";
	import { onDestroy, onMount } from "svelte";
	import { SvelteMap } from "svelte/reactivity";
	import { createLogger } from "@shared/logger";

	const logger = createLogger("ui");

	interface Props {
		value: string;
		language?: string;
		theme?: "light" | "dark";
		readOnly?: boolean;
		fontSize?: number;
		lineWrapping?: boolean;
		onChange?: (value: string) => void;
		onMount?: (view: EditorView) => void;
	}

	const props: Props = $props();

	let container: HTMLDivElement | null = $state(null);
	let view: EditorView | null = $state(null);
	let languageCompartment = new Compartment();
	let readOnlyCompartment = new Compartment();
	let highlighter = $state<ShikiHighlighter | null>(null);

	// Create theme from Shiki's actual theme colors
	const createShikiTheme = (themeName: string, isDark: boolean) => {
		if (!highlighter) return null;

		try {
			const theme = highlighter.getTheme(themeName);
			const bg = theme.bg || (isDark ? "#121212" : "#ffffff");
			const _fg = theme.fg || (isDark ? "#dbd7caee" : "#393a34");

			return EditorView.theme(
				{
					"&": {
						backgroundColor: bg,
						color: _fg,
					},
					".cm-content": {
						caretColor: _fg,
					},
					".cm-cursor, .cm-dropCursor": {
						borderLeftColor: _fg,
					},
					"&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
						{
							backgroundColor: isDark ? "#22282f" : "#b3d8ff",
						},
					".cm-activeLine": {
						backgroundColor: isDark ? "#1b1f2711" : "#f5f5f5",
					},
					".cm-gutters": {
						backgroundColor: isDark ? "#161616" : "#fafafa",
						color: isDark ? "#858585" : "#999999",
						border: "none",
					},
				},
				{ dark: isDark },
			);
		} catch (error) {
			logger.warn("Failed to create theme from Shiki:", error);
			return null;
		}
	};

	// Create highlight style from Shiki theme colors
	const createShikiHighlightStyle = (themeName: string) => {
		if (!highlighter) return null;

		try {
			const theme = highlighter.getTheme(themeName);

			// Map TextMate scope names to CodeMirror tags
			const styleRules: Array<{
				tag: (typeof tags)[keyof typeof tags];
				color: string;
				fontStyle?: string;
			}> = [];

			// Extract colors from theme settings
			const settings = (theme.settings || theme.tokenColors || []) as Array<{
				settings?: { foreground?: string };
				scope: string | string[];
			}>;
			// Note: SvelteMap is used in non-reactive function scope
			const colorMap = new SvelteMap<string, string>();

			settings.forEach((setting) => {
				if (!setting.settings?.foreground) return;
				const color = setting.settings.foreground;
				const scopes = Array.isArray(setting.scope) ? setting.scope : [setting.scope];

				scopes.forEach((scope: string) => {
					if (scope) {
						colorMap.set(scope, color);
						// Also add partial matches for nested scopes
						const parts = scope.split(".");
						for (let i = parts.length; i > 0; i--) {
							const partial = parts.slice(0, i).join(".");
							if (!colorMap.has(partial)) {
								colorMap.set(partial, color);
							}
						}
					}
				});
			});

			// Map common scopes to CodeMirror tags with comprehensive coverage
			// Try multiple possible scope names for each tag
			const scopeToTag: Array<[string[], (typeof tags)[keyof typeof tags], string?]> = [
				// Keywords
				[["keyword", "storage.type", "storage.modifier", "keyword.control"], tags.keyword],

				// Comments
				[["comment", "punctuation.definition.comment"], tags.comment, "italic"],

				// Strings
				[["string", "string.quoted", "string.template"], tags.string],

				// Numbers
				[
					[
						"constant.numeric",
						"constant.language.numeric",
						"constant.numeric.integer",
						"constant.numeric.decimal",
					],
					tags.number,
				],

				// Booleans and null
				[["constant.language.boolean", "constant.language"], tags.bool],
				[["constant.language.null", "constant.language.undefined"], tags.null],

				// Operators
				[
					["keyword.operator", "punctuation.separator", "keyword.operator.assignment"],
					tags.operator,
				],

				// Variables
				[
					["variable", "variable.other", "variable.parameter", "variable.language"],
					tags.variableName,
				],

				// Functions
				[
					["entity.name.function", "support.function", "meta.function-call"],
					tags.function(tags.variableName),
				],

				// Types
				[
					["entity.name.type", "support.type", "support.class", "entity.name.class"],
					tags.typeName,
				],

				// Properties (CSS/JS/JSON) - most important for CSS
				[
					[
						"support.type.property-name",
						"meta.property-name",
						"variable.other.property",
						"support.type.property-name.css",
						"meta.property-name.css",
						"entity.name.tag.css",
					],
					tags.propertyName,
				],

				// Tags (HTML/XML)
				[["entity.name.tag", "meta.tag.sgml", "entity.name.tag.html"], tags.tagName],

				// Attributes (HTML)
				[
					["entity.other.attribute-name", "entity.other.attribute-name.html"],
					tags.attributeName,
				],

				// Constants
				[["constant", "constant.other", "variable.other.constant"], tags.literal],

				// Meta/Punctuation
				[["punctuation", "meta.brace", "punctuation.definition"], tags.punctuation],

				// Markdown-specific tags
				// Headings (all levels)
				[
					[
						"markup.heading",
						"entity.name.section",
						"heading",
						"markup.heading.1",
						"markup.heading.2",
						"markup.heading.3",
						"markup.heading.4",
						"markup.heading.5",
						"markup.heading.6",
					],
					tags.heading,
					"bold",
				],

				// Bold/Strong
				[["markup.bold", "strong", "punctuation.definition.bold"], tags.strong, "bold"],

				// Italic/Emphasis
				[
					["markup.italic", "emphasis", "punctuation.definition.italic"],
					tags.emphasis,
					"italic",
				],

				// Links and URLs
				[
					["markup.underline.link", "string.other.link", "meta.link", "meta.link.inline"],
					tags.link,
				],
				[["markup.underline.link.image", "meta.image"], tags.link],

				// Inline code
				[
					[
						"markup.inline.raw",
						"markup.raw",
						"markup.raw.inline",
						"markup.raw.inline.markdown",
					],
					tags.monospace,
				],

				// Code blocks
				[
					["markup.fenced_code.block", "markup.raw.block", "markup.raw.block.markdown"],
					tags.monospace,
				],

				// Quote/Blockquote
				[
					["markup.quote", "punctuation.definition.quote", "markup.quote.markdown"],
					tags.quote,
					"italic",
				],

				// List markers
				[
					[
						"markup.list",
						"punctuation.definition.list",
						"beginning.punctuation",
						"markup.list.unnumbered",
						"markup.list.numbered",
					],
					tags.list,
				],

				// Strikethrough
				[
					["markup.strikethrough", "punctuation.definition.strikethrough"],
					tags.strikethrough,
				],

				// Code block info string (language identifier)
				[
					[
						"fenced_code.block.language",
						"markup.fenced_code.block.language",
						"entity.name.label",
					],
					tags.labelName,
				],

				// Horizontal rules / separators
				[
					["meta.separator", "punctuation.definition.thematic-break"],
					tags.contentSeparator,
				],

				// Escape characters
				[["constant.character.escape", "punctuation.definition.constant"], tags.escape],

				// Meta/frontmatter
				[
					[
						"meta.embedded",
						"meta.separator.front-matter",
						"punctuation.definition.front-matter",
					],
					tags.meta,
				],

				// Definition/reference links
				[["constant.other.reference.link", "meta.link.reference"], tags.labelName],
			];

			scopeToTag.forEach(([scopes, tag, fontStyle]) => {
				for (const scope of scopes) {
					const color = colorMap.get(scope);
					if (color) {
						const rule: {
							tag: (typeof tags)[keyof typeof tags];
							color: string;
							fontStyle?: string;
						} = {
							tag,
							color,
						};
						if (fontStyle) rule.fontStyle = fontStyle;
						styleRules.push(rule);
						break; // Found a color for this tag, no need to check other scopes
					}
				}
			});

			// Add default markdown styling if not covered by theme
			const isDark = themeName.includes("dark");
			const _fg = theme.fg || (isDark ? "#dbd7caee" : "#393a34");
			const accentColor = colorMap.get("keyword") || (isDark ? "#4EC9B0" : "#0070C1");
			const stringColor = colorMap.get("string") || (isDark ? "#CE9178" : "#A31515");
			const commentColor = colorMap.get("comment") || (isDark ? "#6A9955" : "#008000");
			const typeColor = colorMap.get("entity.name.type") || (isDark ? "#4FC1FF" : "#267F99");
			const numberColor =
				colorMap.get("constant.numeric") || (isDark ? "#B5CEA8" : "#098658");
			const metaColor = isDark ? "#808080" : "#999999";

			// Default markdown fallback styles - comprehensive coverage
			const markdownDefaults: Array<{
				tag: (typeof tags)[keyof typeof tags];
				color?: string;
				fontStyle?: string;
				fontWeight?: string;
			}> = [
				// Headings (all levels)
				{ tag: tags.heading, color: accentColor, fontWeight: "bold" },
				{ tag: tags.heading1, color: accentColor, fontWeight: "bold" },
				{ tag: tags.heading2, color: accentColor, fontWeight: "bold" },
				{ tag: tags.heading3, color: accentColor, fontWeight: "bold" },
				{ tag: tags.heading4, color: accentColor, fontWeight: "bold" },
				{ tag: tags.heading5, color: accentColor, fontWeight: "bold" },
				{ tag: tags.heading6, color: accentColor, fontWeight: "bold" },

				// Text formatting
				{ tag: tags.strong, fontWeight: "bold" },
				{ tag: tags.emphasis, fontStyle: "italic" },
				{
					tag: tags.strikethrough,
					textDecoration: "line-through",
				} as (typeof markdownDefaults)[0],

				// Links and URLs
				{
					tag: tags.link,
					color: stringColor,
					textDecoration: "underline",
				} as (typeof markdownDefaults)[0],
				{ tag: tags.url, color: stringColor },

				// Code elements
				{ tag: tags.monospace, color: commentColor },

				// Quote/Blockquote
				{ tag: tags.quote, color: commentColor, fontStyle: "italic" },

				// Lists
				{ tag: tags.list, color: accentColor },

				// Separators (horizontal rules)
				{ tag: tags.contentSeparator, color: metaColor },

				// Labels (code block language, link labels)
				{ tag: tags.labelName, color: typeColor },

				// Meta information (frontmatter, etc.)
				{ tag: tags.meta, color: metaColor },
				{ tag: tags.documentMeta, color: metaColor },

				// Processing instructions (HTML in markdown)
				{ tag: tags.processingInstruction, color: metaColor },

				// Special content
				{ tag: tags.escape, color: numberColor },
				{ tag: tags.character, color: numberColor },
				{ tag: tags.inserted, color: commentColor },
				{ tag: tags.deleted, color: stringColor },
				{ tag: tags.changed, color: accentColor },

				// Definition lists
				{ tag: tags.definition(tags.name), color: accentColor },

				// Images (similar to links)
				{ tag: tags.atom, color: stringColor },
			];

			// Add markdown defaults only if not already defined
			const existingTags = new Set(styleRules.map((r) => r.tag));
			markdownDefaults.forEach((rule) => {
				if (
					!existingTags.has(rule.tag) &&
					(rule.color || rule.fontStyle || rule.fontWeight)
				) {
					styleRules.push(rule as (typeof styleRules)[0]);
				}
			});

			return styleRules.length > 0
				? HighlightStyle.define(
						styleRules as unknown as Parameters<typeof HighlightStyle.define>[0],
					)
				: null;
		} catch (error) {
			logger.warn("Failed to create highlight style from Shiki:", error);
			return null;
		}
	};

	// Get language extension based on language prop
	const getLanguageExtension = (lang: string | undefined): Extension => {
		switch (lang?.toLowerCase()) {
			case "html":
			case "htm":
				return html();
			case "javascript":
			case "js":
				return javascript();
			case "typescript":
			case "ts":
				return javascript({ typescript: true });
			case "css":
			case "scss":
			case "less":
				return css();
			case "json":
				return json();
			case "markdown":
			case "md":
				return markdown({
					base: markdownLanguage,
					codeLanguages: languages,
				});
			case "python":
			case "py":
				return python();
			case "xml":
			case "svg":
				return xml();
			default:
				return html(); // Default to HTML
		}
	};

	// Create editor
	const createEditor = () => {
		if (!container) return;

		const isDark = props.theme === "dark";
		const themeName = isDark ? "vitesse-dark" : "vitesse-light";

		const extensions: Extension[] = [
			basicSetup,
			languageCompartment.of(getLanguageExtension(props.language)),
			// Only add line wrapping if enabled (defaults to true for backwards compatibility)
			...(props.lineWrapping !== false ? [EditorView.lineWrapping] : []),
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					const newValue = update.state.doc.toString();
					props.onChange?.(newValue);
				}
			}),
			// Force proper height and scrolling
			EditorView.theme({
				"&": {
					height: "100%",
					maxHeight: "100%",
				},
				".cm-scroller": {
					overflow: "auto !important",
					height: "100%",
					maxHeight: "100%",
				},
			}),
		];

		// Add Shiki-based theme
		const shikiTheme = createShikiTheme(themeName, isDark);
		const shikiHighlight = createShikiHighlightStyle(themeName);

		if (shikiTheme) {
			extensions.push(shikiTheme);
		}
		if (shikiHighlight) {
			extensions.push(syntaxHighlighting(shikiHighlight));
		}

		// Add read-only if needed
		extensions.push(readOnlyCompartment.of(EditorState.readOnly.of(Boolean(props.readOnly))));

		// Custom font size
		if (props.fontSize) {
			extensions.push(
				EditorView.theme({
					"&": {
						fontSize: `${props.fontSize}px`,
					},
					".cm-scroller": {
						fontFamily:
							'var(--font-mono), ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
					},
				}),
			);
		}

		const state = EditorState.create({
			doc: props.value,
			extensions,
		});

		view = new EditorView({
			state,
			parent: container,
		});

		// Call onMount callback
		props.onMount?.(view);
	};

	// Update value
	const updateValue = (newValue: string) => {
		if (view && view.state.doc.toString() !== newValue) {
			view.dispatch({
				changes: {
					from: 0,
					to: view.state.doc.length,
					insert: newValue,
				},
			});
		}
	};

	// Update language
	const updateLanguage = (newLanguage: string | undefined) => {
		if (view) {
			// Reconfigure with new language extension
			view.dispatch({
				effects: languageCompartment.reconfigure(getLanguageExtension(newLanguage)),
			});
		}
	};

	const updateReadOnly = (readOnly: boolean | undefined) => {
		if (view) {
			view.dispatch({
				effects: readOnlyCompartment.reconfigure(
					EditorState.readOnly.of(Boolean(readOnly)),
				),
			});
		}
	};

	// Reactive updates
	$effect(() => {
		updateValue(props.value);
	});

	$effect(() => {
		updateLanguage(props.language);
	});

	$effect(() => {
		updateReadOnly(props.readOnly);
	});

	onMount(() => {
		ensureHighlighter().then((h) => {
			highlighter = h;
			createEditor();
		});
	});

	onDestroy(() => {
		if (view) {
			view.destroy();
		}
	});

	export const getView = () => view;
	export const focus = () => view?.focus();
</script>

<div bind:this={container} class="codemirror-container"></div>

<style>
	.codemirror-container {
		--vscode-editor-background: hsl(var(--background));
		--vscode-editor-foreground: hsl(var(--foreground));
		width: 100%;
		height: 100%;
		max-height: 100%;
		overflow: hidden;
		position: relative;
	}

	.codemirror-container :global(.cm-editor) {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: hsl(var(--background));
		color: hsl(var(--foreground));
	}

	.codemirror-container :global(.cm-scroller) {
		overflow: auto !important;
		max-height: 100%;
		height: 100%;
	}

	.codemirror-container :global(.cm-content) {
		min-height: 100%;
	}

	.codemirror-container :global(.cm-gutters),
	.codemirror-container :global(.cm-gutters-before) {
		background-color: #161616 !important;
		color: hsl(var(--muted-foreground));
		border-right: 1px solid hsl(var(--border));
	}

	:global(html:not(.dark)) .codemirror-container :global(.cm-gutters),
	:global(html:not(.dark)) .codemirror-container :global(.cm-gutters-before) {
		background-color: #fafafa !important;
	}

	.codemirror-container :global(.cm-activeLineGutter) {
		background-color: hsl(var(--accent) / 0.1);
	}

	.codemirror-container :global(.cm-activeLine) {
		background-color: hsl(var(--accent) / 0.05);
	}

	/* 统一的选中效果 - 深色主题 */
	.codemirror-container :global(.cm-selectionBackground),
	.codemirror-container :global(.cm-focused .cm-selectionBackground),
	.codemirror-container :global(.cm-line)::selection,
	.codemirror-container :global(.cm-content)::selection,
	.codemirror-container :global(*)::selection {
		background: #252525 !important;
		color: inherit !important;
	}

	/* 统一的选中效果 - 浅色模式 */
	:global(html:not(.dark)) .codemirror-container :global(.cm-selectionBackground),
	:global(html:not(.dark)) .codemirror-container :global(.cm-focused .cm-selectionBackground),
	:global(html:not(.dark)) .codemirror-container :global(.cm-line)::selection,
	:global(html:not(.dark)) .codemirror-container :global(.cm-content)::selection,
	:global(html:not(.dark)) .codemirror-container :global(*)::selection {
		background: #d0d0d0 !important;
		color: inherit !important;
	}

	.codemirror-container :global(.cm-cursor) {
		border-left-color: hsl(var(--foreground));
	}

	.codemirror-container :global(.cm-focused .cm-cursor) {
		border-left-color: hsl(var(--primary));
	}

	/* 匹配高亮 */
	.codemirror-container :global(.cm-selectionMatch) {
		background-color: #5a5a5a !important;
	}

	:global(html:not(.dark)) .codemirror-container :global(.cm-selectionMatch) {
		background-color: #eaeaea !important;
	}
</style>
