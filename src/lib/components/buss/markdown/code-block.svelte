<script lang="ts">
	/* eslint-disable svelte/no-at-html-tags */
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { CopyButton } from "$lib/components/buss/copy-button";
	import * as m from "$lib/paraglide/messages.js";
	import { htmlPreviewState } from "$lib/stores/html-preview-state.svelte";
	import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";
	import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
	import { persistedThemeState } from "$lib/stores/theme.state.svelte";
	import {
		ChevronDown,
		CodeXml,
		Download,
		ExternalLink,
		GitBranch,
		ImagePlay,
		MonitorPlay,
	} from "@lucide/svelte";
	import type { GrammarState, ThemedToken } from "@shikijs/types";
	import mermaid from "mermaid";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";
	import { SvelteMap } from "svelte/reactivity";
	import { downloadCode } from "./download-utils";
	import type { ShikiHighlighter } from "./highlighter";
	import {
		ensureHighlighter,
		ensureLanguageLoaded,
		isLanguageLoaded,
		LANGUAGE_ALIASES,
	} from "./highlighter";

	interface RenderedToken {
		id: string;
		html: string;
	}

	interface RenderedLine {
		id: string;
		number: number;
		tokens: RenderedToken[];
		html: string;
		complete: boolean;
	}

	interface Props {
		blockId: string;
		code: string;
		language: string | null;
		meta: string | null;
		theme?: string | null;
		messageId?: string;
		messagePartIndex?: number;
		isStreaming?: boolean;
	}

	const props: Props = $props();

	let highlighter = $state<ShikiHighlighter | null>(null);
	let grammarState: GrammarState | undefined;
	let lastCode = "";
	let lastChunk = "";
	let resolvedTheme = $state<string>("");
	let preStyle = $state<string | undefined>(undefined);
	let codeStyle = $state<string | undefined>(undefined);
	let lines = $state<RenderedLine[]>([]);
	const lineCount = $derived(lines.length);
	let isCollapsed = $state(preferencesSettings.autoHideCode);
	let showSvgPreview = $state(false);
	let isSvgCode = $state(false);
	let isHtmlCode = $state(false);
	let isMermaidCode = $state(false);
	let showMermaidPreview = $state(false);
	let mermaidSvg = $state("");
	let mermaidError = $state<string | null>(null);
	const isStreaming = $derived(props.isStreaming ?? false);

	const FONT_STYLE = {
		Italic: 1,
		Bold: 2,
		Underline: 4,
		Strikethrough: 8,
	} as const;

	const hashString = (input: string): string => {
		let hash = 2166136261;
		for (let index = 0; index < input.length; index += 1) {
			hash ^= input.charCodeAt(index);
			hash = Math.imul(hash, 16777619);
		}
		return (hash >>> 0).toString(36);
	};

	const escapeHtml = (value: string): string =>
		value
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");

	const escapeAttribute = (value: string): string => escapeHtml(value).replace(/\n/g, "&#10;");

	const formatTokenContent = (content: string): string =>
		escapeHtml(content).replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;").replace(/ /g, "&nbsp;");

	const formatLanguageName = (lang: string): string => {
		if (!lang || lang === "plaintext") return "Text";

		const languageNames: Record<string, string> = {
			js: "JavaScript",
			jsx: "JavaScript",
			ts: "TypeScript",
			tsx: "TypeScript",
			py: "Python",
			python: "Python",
			html: "HTML",
			css: "CSS",
			scss: "SCSS",
			sass: "Sass",
			less: "Less",
			json: "JSON",
			xml: "XML",
			yaml: "YAML",
			yml: "YAML",
			md: "Markdown",
			markdown: "Markdown",
			sh: "Shell",
			bash: "Bash",
			zsh: "Zsh",
			fish: "Fish",
			powershell: "PowerShell",
			sql: "SQL",
			java: "Java",
			cpp: "C++",
			c: "C",
			cs: "C#",
			php: "PHP",
			rb: "Ruby",
			ruby: "Ruby",
			go: "Go",
			rust: "Rust",
			swift: "Swift",
			kotlin: "Kotlin",
			dart: "Dart",
			vue: "Vue",
			svelte: "Svelte",
			angular: "Angular",
			react: "React",
			svg: "SVG",
		};

		return languageNames[lang.toLowerCase()] || lang.charAt(0).toUpperCase() + lang.slice(1);
	};

	const detectSvg = (code: string, language: string | null): boolean => {
		if (language?.toLowerCase() === "svg") return true;

		// If language is explicitly specified and is not SVG, don't detect from content
		if (language && language !== "plaintext") {
			return false;
		}

		const trimmed = code.trim();
		return trimmed.startsWith("<svg") || (trimmed.startsWith("<?xml") && trimmed.includes("<svg"));
	};

	const detectHtml = (code: string, language: string | null): boolean => {
		const htmlLanguages = ["html", "htm", "xhtml", "xml"];
		if (language && htmlLanguages.includes(language.toLowerCase())) {
			return true;
		}

		// If language is explicitly specified and is not HTML-like, don't detect from content
		if (language && language !== "plaintext") {
			return false;
		}

		const trimmed = code.trim();
		const htmlTagRegex =
			/<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>(.*?)<\/\1>|<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/>/s;
		return htmlTagRegex.test(trimmed);
	};

	const detectMermaid = (code: string, language: string | null): boolean => {
		if (language?.toLowerCase() === "mermaid") return true;

		// If language is explicitly specified and is not mermaid, don't detect from content
		if (language && language !== "plaintext") {
			return false;
		}

		const trimmed = code.trim().toLowerCase();
		const mermaidKeywords = [
			"graph ",
			"flowchart ",
			"sequencediagram",
			"classdiagram",
			"statediagram",
			"erdiagram",
			"journey",
			"gantt",
			"pie",
			"requirementdiagram",
			"gitgraph",
			"mindmap",
			"timeline",
			"c4context",
			"c4container",
			"c4component",
			"c4dynamic",
			"c4deployment",
		];
		return mermaidKeywords.some((kw) => trimmed.startsWith(kw));
	};

	const renderMermaid = async (code: string) => {
		if (!code.trim()) {
			mermaidSvg = "";
			return;
		}

		try {
			mermaidError = null;
			// Initialize mermaid with theme based on current app theme
			const isDark = persistedThemeState.current.shouldUseDarkColors;
			mermaid.initialize({
				startOnLoad: false,
				theme: isDark ? "dark" : "default",
				securityLevel: "strict",
			});

			// Generate unique ID for this render
			const id = `mermaid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
			const { svg } = await mermaid.render(id, code);
			mermaidSvg = svg;
		} catch (error) {
			console.error("Mermaid render error:", error);
			mermaidError = error instanceof Error ? error.message : "Failed to render diagram";
			mermaidSvg = "";
		}
	};

	const toggleCollapse = () => {
		isCollapsed = !isCollapsed;
	};

	const toggleSvgPreview = () => {
		showSvgPreview = !showSvgPreview;
	};

	const toggleMermaidPreview = () => {
		showMermaidPreview = !showMermaidPreview;
		if (showMermaidPreview && isMermaidCode && !isStreaming) {
			void renderMermaid(props.code);
		}
	};

	const handleOpenMermaidInNewTab = async () => {
		if (isStreaming) {
			return;
		}
		if (!mermaidSvg) {
			// Ensure mermaid is rendered before opening in new tab
			await renderMermaid(props.code);
		}

		// Wrap mermaid SVG in an interactive HTML document with pan & zoom
		const htmlContent = buildMermaidPreviewHtml(mermaidSvg);

		// Generate unique previewId
		const previewId = `mermaid-${props.blockId}`;

		// Create new tab with mermaid content as HTML preview
		await tabBarState.handleNewTab(
			m.title_mermaid_preview(),
			"htmlPreview",
			true,
			"/html-preview",
			htmlContent,
			previewId,
		);
	};

	const buildMermaidPreviewHtml = (svg: string): string => {
		const htmlParts = [
			"<!DOCTYPE html>",
			"<html>",
			"<head>",
			'<meta charset="UTF-8">',
			'<meta name="viewport" content="width=device-width, initial-scale=1.0">',
			"<title>Mermaid Diagram</title>",
			"<style>",
			"* { margin: 0; padding: 0; box-sizing: border-box; }",
			"html, body { width: 100%; height: 100%; overflow: hidden; background-color: #f5f5f5; }",
			".viewport { width: 100%; height: 100%; overflow: hidden; cursor: grab; position: relative; }",
			".viewport.dragging { cursor: grabbing; }",
			".mermaid-container { position: absolute; transform-origin: 0 0; padding: 40px; }",
			".mermaid-container svg { display: block; max-width: none; height: auto; shape-rendering: geometricPrecision; text-rendering: geometricPrecision; image-rendering: optimizeQuality; }",
			".controls { position: fixed; bottom: 20px; right: 20px; display: flex; gap: 8px; z-index: 100; }",
			".controls button { width: 40px; height: 40px; border: none; border-radius: 8px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.15); cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: background 0.2s, transform 0.1s; }",
			".controls button:hover { background: #f0f0f0; }",
			".controls button:active { transform: scale(0.95); }",
			".zoom-info { position: fixed; bottom: 20px; left: 20px; padding: 8px 12px; background: white; border-radius: 6px; font-family: system-ui, sans-serif; font-size: 13px; color: #666; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }",
			"@media (prefers-color-scheme: dark) { html, body { background-color: #1a1a1a; } .controls button { background: #2d2d2d; color: #fff; } .controls button:hover { background: #3d3d3d; } .zoom-info { background: #2d2d2d; color: #aaa; } }",
			"</style>",
			"</head>",
			"<body>",
			'<div class="viewport" id="viewport">',
			'<div class="mermaid-container" id="container">',
			svg,
			"</div>",
			"</div>",
			'<div class="controls">',
			'<button id="zoomIn" title="Zoom In">+</button>',
			'<button id="zoomOut" title="Zoom Out">−</button>',
			'<button id="reset" title="Reset View">⟲</button>',
			"</div>",
			'<div class="zoom-info" id="zoomInfo">100%</div>',
			"<script>",
			"(function() {",
			"var viewport = document.getElementById('viewport');",
			"var container = document.getElementById('container');",
			"var zoomInfo = document.getElementById('zoomInfo');",
			"var scale = 1, panX = 0, panY = 0, isDragging = false, startX = 0, startY = 0, initialScale = 1;",
			"var minScale = 0.1, maxScale = 10;",
			"function updateTransform() { container.style.left = panX + 'px'; container.style.top = panY + 'px'; container.style.zoom = scale; zoomInfo.textContent = Math.round(scale * 100) + '%'; }",
			"function fitToViewport() { var vw = viewport.clientWidth, vh = viewport.clientHeight, svg = container.querySelector('svg'); if (!svg) return; container.style.zoom = 1; var sw = svg.offsetWidth || svg.getBoundingClientRect().width, sh = svg.offsetHeight || svg.getBoundingClientRect().height; var padding = 80; var scaleX = (vw - padding) / (sw + 80), scaleY = (vh - padding) / (sh + 80); initialScale = Math.min(scaleX, scaleY, 3); initialScale = Math.max(initialScale, 0.5); scale = initialScale; var cw = (sw + 80) * scale, ch = (sh + 80) * scale; panX = (vw - cw) / 2; panY = (vh - ch) / 2; updateTransform(); }",
			"function centerContent() { var vw = viewport.clientWidth, vh = viewport.clientHeight, cw = container.offsetWidth * scale, ch = container.offsetHeight * scale; panX = (vw - cw) / 2; panY = (vh - ch) / 2; updateTransform(); }",
			"function tryFit(attempts) { if (attempts <= 0) return; var svg = container.querySelector('svg'); if (svg && svg.getBoundingClientRect().width > 0) { fitToViewport(); } else { setTimeout(function() { tryFit(attempts - 1); }, 50); } }",
			"if (document.readyState === 'complete') { tryFit(10); } else { window.addEventListener('load', function() { tryFit(10); }); }",
			"viewport.addEventListener('mousedown', function(e) { if (e.button !== 0) return; isDragging = true; startX = e.clientX - panX; startY = e.clientY - panY; viewport.classList.add('dragging'); e.preventDefault(); });",
			"document.addEventListener('mousemove', function(e) { if (!isDragging) return; panX = e.clientX - startX; panY = e.clientY - startY; updateTransform(); e.preventDefault(); });",
			"document.addEventListener('mouseup', function() { isDragging = false; viewport.classList.remove('dragging'); });",
			"viewport.addEventListener('wheel', function(e) { e.preventDefault(); var rect = viewport.getBoundingClientRect(), mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top, prevScale = scale, delta = e.deltaY > 0 ? 0.9 : 1.1; scale = Math.min(maxScale, Math.max(minScale, scale * delta)); var scaleRatio = scale / prevScale; panX = mouseX - (mouseX - panX) * scaleRatio; panY = mouseY - (mouseY - panY) * scaleRatio; updateTransform(); }, { passive: false });",
			"document.getElementById('zoomIn').addEventListener('click', function() { var vw = viewport.clientWidth / 2, vh = viewport.clientHeight / 2, prevScale = scale; scale = Math.min(maxScale, scale * 1.2); var scaleRatio = scale / prevScale; panX = vw - (vw - panX) * scaleRatio; panY = vh - (vh - panY) * scaleRatio; updateTransform(); });",
			"document.getElementById('zoomOut').addEventListener('click', function() { var vw = viewport.clientWidth / 2, vh = viewport.clientHeight / 2, prevScale = scale; scale = Math.max(minScale, scale / 1.2); var scaleRatio = scale / prevScale; panX = vw - (vw - panX) * scaleRatio; panY = vh - (vh - panY) * scaleRatio; updateTransform(); });",
			"document.getElementById('reset').addEventListener('click', function() { fitToViewport(); });",
			"window.addEventListener('resize', fitToViewport);",
			"})();",
			"</" + "script>",
			"</body>",
			"</html>",
		];
		return htmlParts.join("\n");
	};

	const toggleHtmlPreview = () => {
		if (props.messageId === undefined || props.messagePartIndex === undefined) {
			return;
		}
		const languageForPreview = resolvedLanguage === "plaintext" ? null : resolvedLanguage;
		htmlPreviewState.togglePreview({
			code: props.code,
			language: languageForPreview,
			messageId: props.messageId,
			messagePartIndex: props.messagePartIndex,
			blockId: props.blockId,
			meta: props.meta ?? null,
		});
	};

	const handleDownload = () => {
		const fileName = downloadCode(props.code, resolvedLanguage);
		toast.success(m.toast_download_file_success({ fileName }));
	};

	const buildTokenStyle = (token: ThemedToken): string | undefined => {
		if (token.htmlStyle) {
			return Object.entries(token.htmlStyle)
				.map(([key, value]) => `${key}:${value}`)
				.join(";");
		}

		const parts: string[] = [];
		if (token.color) {
			parts.push(`color:${token.color}`);
		}
		if (token.bgColor) {
			parts.push(`background-color:${token.bgColor}`);
		}

		const fontStyle = token.fontStyle ?? 0;
		if (fontStyle & FONT_STYLE.Italic) {
			parts.push("font-style:italic");
		}
		if (fontStyle & FONT_STYLE.Bold) {
			parts.push("font-weight:700");
		}
		const decorations: string[] = [];
		if (fontStyle & FONT_STYLE.Underline) {
			decorations.push("underline");
		}
		if (fontStyle & FONT_STYLE.Strikethrough) {
			decorations.push("line-through");
		}
		if (decorations.length > 0) {
			parts.push(`text-decoration:${decorations.join(" ")}`);
		}

		return parts.length ? parts.join(";") : undefined;
	};

	const renderTokens = ({
		lineIndex,
		tokens,
		complete,
	}: {
		lineIndex: number;
		tokens: ThemedToken[];
		complete: boolean;
	}): RenderedLine => {
		const lineId = `${props.blockId}-line-${lineIndex}`;
		const signatureCounts = new SvelteMap<string, number>();
		const printable = tokens.filter((token) => token.content !== "\n");
		const sourceTokens =
			printable.length > 0 ? printable : [{ content: "", offset: 0 } as ThemedToken];
		const renderedTokens = sourceTokens.map((token) => {
			const key = `${token.content}|${token.color ?? ""}|${token.fontStyle ?? ""}|${
				token.htmlStyle ? JSON.stringify(token.htmlStyle) : ""
			}`;
			const occurrence = signatureCounts.get(key) ?? 0;
			signatureCounts.set(key, occurrence + 1);
			const style = buildTokenStyle(token);
			const attrs: string[] = ['class="token"'];
			if (style) {
				attrs.push(`style="${escapeAttribute(style)}"`);
			}
			if (token.htmlAttrs) {
				for (const [name, value] of Object.entries(token.htmlAttrs)) {
					if (value == null) continue;
					attrs.push(`${name}="${escapeAttribute(String(value))}"`);
				}
			}
			const formatted = formatTokenContent(token.content ?? "") || "&nbsp;";
			return {
				id: `${lineId}-${hashString(`${token.content}|${style ?? ""}`)}-${occurrence}`,
				html: `<span ${attrs.join(" ")}>${formatted}</span>`,
			};
		});

		return {
			id: lineId,
			number: lineIndex + 1,
			tokens: renderedTokens,
			html: renderedTokens.map((token) => token.html).join(""),
			complete,
		};
	};

	const resetState = () => {
		grammarState = undefined;
		lastCode = "";
		lastChunk = "";
		preStyle = undefined;
		codeStyle = undefined;
		lines = [];
	};

	const applyStyles = (result: { fg?: string; bg?: string; rootStyle?: string }) => {
		if (result.rootStyle && !preStyle) {
			preStyle = result.rootStyle;
		}
		if (result.fg && !codeStyle) {
			codeStyle = `color:${result.fg}`;
		}
		if (result.bg && !preStyle) {
			preStyle = `background-color:${result.bg}`;
		}
	};

	const appendLine = (tokens: ThemedToken[], complete: boolean) => {
		const replaceExisting = lines.length > 0 && !lines[lines.length - 1].complete;
		const lineIndex = replaceExisting ? lines.length - 1 : lines.length;
		const rendered = renderTokens({ lineIndex, tokens, complete });
		if (replaceExisting) {
			lines = [...lines.slice(0, lineIndex), rendered, ...lines.slice(lineIndex + 1)];
		} else {
			lines = [...lines, rendered];
		}
	};

	const processChunk = (chunk: string) => {
		if (!highlighter) {
			return;
		}

		const renderLanguage = getRenderLanguage();
		const pieces = (lastChunk + chunk).split("\n");
		for (let index = 0; index < pieces.length; index += 1) {
			const piece = pieces[index];
			const isLast = index === pieces.length - 1;
			const result = highlighter.codeToTokens(piece, {
				lang: renderLanguage as never,
				theme: resolvedTheme,
				grammarState,
			});
			const tokens = result.tokens.at(0) ?? [];

			applyStyles(result);

			if (!isLast) {
				tokens.push({ content: "\n", offset: 0 } as ThemedToken);
				grammarState = result.grammarState;
				lastChunk = "";
				appendLine(tokens, true);
			} else {
				lastChunk = piece;
				appendLine(tokens, false);
			}
		}
	};

	let resolvedLanguage = $state("plaintext");

	const ensureLanguage = (): boolean => {
		const raw = props.language?.toLowerCase().trim() || "plaintext";
		const effectiveLang = LANGUAGE_ALIASES[raw] ?? raw;

		if (resolvedLanguage !== effectiveLang) {
			resolvedLanguage = effectiveLang;
			const targetLanguage = effectiveLang;
			ensureLanguageLoaded(targetLanguage)
				.then(() => {
					if (!highlighter || resolvedLanguage !== targetLanguage) {
						return;
					}
					resetState();
					syncCode(props.code);
				})
				.catch((error) => {
					console.warn(`Failed to load language ${targetLanguage}:`, error);
				});
			return true;
		}
		return false;
	};

	const getRenderLanguage = (): string =>
		isLanguageLoaded(resolvedLanguage) ? resolvedLanguage : "plaintext";

	const updateTheme = (): boolean => {
		const requested = props.theme?.trim();
		let next = persistedThemeState.current.shouldUseDarkColors ? "vitesse-dark" : "vitesse-light";
		if (requested && highlighter) {
			try {
				const loaded = highlighter.getInternalContext().getLoadedThemes();
				next = loaded.includes(requested) ? requested : next;
			} catch (error) {
				console.warn("Unable to read loaded themes", error);
			}
		} else if (requested) {
			next = requested;
		}

		if (resolvedTheme !== next) {
			resolvedTheme = next;
			return true;
		}
		return false;
	};

	const syncCode = (code: string) => {
		if (!highlighter) {
			return;
		}

		const renderLanguage = getRenderLanguage();

		if (!code) {
			resetState();
			lines = [];
			return;
		}

		if (!lastCode || !code.startsWith(lastCode)) {
			resetState();
			const chunks = code.split("\n");
			for (let i = 0; i < chunks.length; i += 1) {
				const segment = chunks[i];
				const isLast = i === chunks.length - 1;
				const result = highlighter.codeToTokens(segment, {
					lang: renderLanguage as never,
					theme: resolvedTheme,
					grammarState,
				});
				const tokens = result.tokens.at(0) ?? [];
				applyStyles(result);
				if (!isLast) {
					tokens.push({ content: "\n", offset: 0 } as ThemedToken);
					grammarState = result.grammarState;
					appendLine(tokens, true);
				} else {
					lastChunk = segment;
					appendLine(tokens, false);
				}
			}
			lastCode = code;
			return;
		}

		const diff = code.slice(lastCode.length);
		if (diff.length > 0) {
			processChunk(diff);
			lastCode = code;
		}
	};

	onMount(async () => {
		highlighter = await ensureHighlighter();
		ensureLanguage();
		updateTheme();
		syncCode(props.code);
	});

	$effect(() => {
		if (ensureLanguage() && highlighter) {
			resetState();
			syncCode(props.code);
		}
	});

	$effect(() => {
		if (!highlighter) return;
		// Re-render when theme prop or app theme changes
		void persistedThemeState.current.shouldUseDarkColors; // Access to track changes
		if (updateTheme()) {
			resetState();
			syncCode(props.code);
		}
	});

	$effect(() => {
		if (!highlighter) return;
		const { code } = props;
		syncCode(code);
	});

	$effect(() => {
		isSvgCode = detectSvg(props.code, props.language);
		isHtmlCode = detectHtml(props.code, props.language);
		const wasMermaid = isMermaidCode;
		isMermaidCode = detectMermaid(props.code, props.language);
		// Auto-enable preview when mermaid is first detected
		if (!wasMermaid && isMermaidCode) {
			showMermaidPreview = true;
		}
	});

	$effect(() => {
		if (!showMermaidPreview || !isMermaidCode) return;
		if (isStreaming) {
			mermaidSvg = "";
			mermaidError = null;
			return;
		}
		void renderMermaid(props.code);
	});
</script>

{#if !highlighter}
	{#if props.code.trim()}
		<div
			data-code-block-wrapper
			class="rounded-xl overflow-hidden border border-border my-7 bg-card"
		>
			<div
				class="flex justify-between items-center px-4 py-2 bg-muted border-b border-border min-h-10"
			>
				<span class="text-sm font-medium text-muted-foreground select-none">
					{formatLanguageName(props.language ?? "plaintext")}
				</span>
				<div class="flex items-center gap-1">
					<CopyButton content={props.code} position="bottom" />
					<ButtonWithTooltip
						class="text-muted-foreground hover:!bg-chat-action-hover"
						tooltip="Download"
						tooltipSide="bottom"
						onclick={handleDownload}
					>
						<Download />
					</ButtonWithTooltip>
					<ButtonWithTooltip
						class="text-muted-foreground hover:!bg-chat-action-hover"
						tooltip="Toggle collapse"
						tooltipSide="bottom"
						onclick={toggleCollapse}
					>
						<ChevronDown
							class={`transition-transform duration-200 ${isCollapsed ? "rotate-180" : ""}`}
						/>
					</ButtonWithTooltip>
				</div>
			</div>
			<pre
				class="shiki !m-0 !rounded-none !border-0 overflow-x-auto {isCollapsed
					? 'max-h-[120px] overflow-y-auto'
					: ''}"
				data-theme={props.theme ?? resolvedTheme}
				data-meta={props.meta ?? undefined}>
				<code class="block w-max">{props.code}</code>
			</pre>
		</div>
	{/if}
{:else if props.code.trim() && lineCount > 0}
	<div data-code-block-wrapper class="rounded-xl overflow-hidden border border-border my-7 bg-card">
		<div
			class="flex justify-between items-center px-4 py-2 bg-muted border-b border-border min-h-10"
		>
			<span class="text-sm font-medium text-muted-foreground select-none"
				>{formatLanguageName(resolvedLanguage)}</span
			>
			<div class="flex items-center gap-1">
				<CopyButton content={props.code} position="bottom" />
				<ButtonWithTooltip
					class="text-muted-foreground hover:!bg-chat-action-hover"
					tooltip="Download"
					tooltipSide="bottom"
					onclick={handleDownload}
				>
					<Download />
				</ButtonWithTooltip>
				{#if isSvgCode}
					<ButtonWithTooltip
						class="text-muted-foreground hover:!bg-chat-action-hover"
						tooltip={showSvgPreview ? "Show code" : "Preview SVG"}
						tooltipSide="bottom"
						onclick={toggleSvgPreview}
					>
						{#if showSvgPreview}
							<CodeXml class="" />
						{:else}
							<ImagePlay class="" />
						{/if}
					</ButtonWithTooltip>
				{/if}
				{#if isMermaidCode}
					<ButtonWithTooltip
						class="text-muted-foreground hover:!bg-chat-action-hover"
						tooltip={showMermaidPreview ? m.tooltip_show_code() : m.tooltip_preview_diagram()}
						tooltipSide="bottom"
						onclick={toggleMermaidPreview}
					>
						{#if showMermaidPreview}
							<CodeXml class="" />
						{:else}
							<GitBranch class="" />
						{/if}
					</ButtonWithTooltip>
					<ButtonWithTooltip
						class="text-muted-foreground hover:!bg-chat-action-hover"
						tooltip={isStreaming ? "Waiting for output to finish..." : m.tooltip_open_in_new_tab()}
						tooltipSide="bottom"
						disabled={isStreaming}
						onclick={handleOpenMermaidInNewTab}
					>
						<ExternalLink class="" />
					</ButtonWithTooltip>
				{/if}
				{#if isHtmlCode && props.messageId !== undefined && props.messagePartIndex !== undefined}
					<ButtonWithTooltip
						class="text-muted-foreground hover:!bg-chat-action-hover"
						tooltip={htmlPreviewState.isVisible ? "Close preview" : "Preview HTML"}
						tooltipSide="bottom"
						onclick={toggleHtmlPreview}
					>
						<MonitorPlay class="" />
					</ButtonWithTooltip>
				{/if}
				<ButtonWithTooltip
					class="text-muted-foreground hover:!bg-chat-action-hover"
					tooltip="Toggle collapse"
					tooltipSide="bottom"
					onclick={toggleCollapse}
				>
					<ChevronDown
						class={`transition-transform duration-200 ${isCollapsed ? "rotate-180" : ""}`}
					/>
				</ButtonWithTooltip>
			</div>
		</div>
		{#if showSvgPreview && isSvgCode}
			<div class="p-4 bg-background flex items-center justify-center min-h-[200px]">
				{@html props.code}
			</div>
		{:else if showMermaidPreview && isMermaidCode}
			<div class="p-4 bg-background flex items-center justify-center min-h-[200px] overflow-auto">
				{#if mermaidError}
					<div class="text-destructive text-sm">
						<p class="font-medium">Failed to render diagram:</p>
						<p>{mermaidError}</p>
					</div>
				{:else if isStreaming}
					<div class="text-muted-foreground">Waiting for output to finish...</div>
				{:else if mermaidSvg}
					<div class="mermaid-diagram">
						{@html mermaidSvg}
					</div>
				{:else}
					<div class="text-muted-foreground">Loading diagram...</div>
				{/if}
			</div>
		{:else}
			<pre
				class="shiki !m-0 !rounded-none !border-0 overflow-x-auto {isCollapsed
					? 'max-h-[120px] overflow-y-auto'
					: ''}"
				data-language={resolvedLanguage}
				data-theme={resolvedTheme}
				data-meta={props.meta ?? undefined}
				style={preStyle}>
				<code style={codeStyle} class="block w-max">
					{#each lines as line (line.id)}
						<span class="line" data-line={line.number}>{@html line.html}</span>
					{/each}
				</code>
			</pre>
		{/if}
	</div>
{/if}
