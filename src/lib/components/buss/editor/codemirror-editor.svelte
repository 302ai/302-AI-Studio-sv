<script lang="ts">
	import type { ShikiHighlighter } from "$lib/components/buss/markdown/highlighter";
	import { ensureHighlighter } from "$lib/components/buss/markdown/highlighter";
	import { css } from "@codemirror/lang-css";
	import { html } from "@codemirror/lang-html";
	import { javascript } from "@codemirror/lang-javascript";
	import { json } from "@codemirror/lang-json";
	import { markdown } from "@codemirror/lang-markdown";
	import { python } from "@codemirror/lang-python";
	import { xml } from "@codemirror/lang-xml";
	import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
	import { Compartment, EditorState, type Extension } from "@codemirror/state";
	import { tags } from "@lezer/highlight";
	import { basicSetup, EditorView } from "codemirror";
	import { onDestroy, onMount } from "svelte";
	import { SvelteMap } from "svelte/reactivity";

	interface Props {
		value: string;
		language?: string;
		theme?: "light" | "dark";
		readOnly?: boolean;
		fontSize?: number;
		// lineNumbers?: boolean;
		// wordWrap?: boolean;
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
			const fg = theme.fg || (isDark ? "#dbd7caee" : "#393a34");

			return EditorView.theme(
				{
					"&": {
						backgroundColor: bg,
						color: fg,
					},
					".cm-content": {
						caretColor: fg,
					},
					".cm-cursor, .cm-dropCursor": {
						borderLeftColor: fg,
					},
					"&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
						{
							backgroundColor: isDark ? "#22282f" : "#b3d8ff",
						},
					".cm-activeLine": {
						backgroundColor: isDark ? "#1b1f2711" : "#f5f5f5",
					},
					".cm-gutters": {
						backgroundColor: bg,
						color: isDark ? "#858585" : "#999999",
						border: "none",
					},
				},
				{ dark: isDark },
			);
		} catch (error) {
			console.warn("Failed to create theme from Shiki:", error);
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
				[["entity.name.type", "support.type", "support.class", "entity.name.class"], tags.typeName],

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
				[["entity.other.attribute-name", "entity.other.attribute-name.html"], tags.attributeName],

				// Constants
				[["constant", "constant.other", "variable.other.constant"], tags.literal],

				// Meta/Punctuation
				[["punctuation", "meta.brace", "punctuation.definition"], tags.punctuation],
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

			return styleRules.length > 0
				? HighlightStyle.define(
						styleRules as unknown as Parameters<typeof HighlightStyle.define>[0],
					)
				: null;
		} catch (error) {
			console.warn("Failed to create highlight style from Shiki:", error);
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
				return markdown();
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
			EditorView.lineWrapping,
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
				effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(Boolean(readOnly))),
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
	}

	.codemirror-container :global(.cm-content) {
		min-height: 0;
	}

	.codemirror-container :global(.cm-gutters) {
		background-color: hsl(var(--muted));
		color: hsl(var(--muted-foreground));
		border-right: 1px solid hsl(var(--border));
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
