<script lang="ts">
	/* eslint-disable svelte/no-at-html-tags */
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { CopyButton } from "$lib/components/buss/copy-button";
	import { htmlPreviewState } from "$lib/stores/html-preview-state.svelte";
	import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";
	import { persistedThemeState } from "$lib/stores/theme.state.svelte";
	import { ChevronDown, CodeXml, ImagePlay, MonitorPlay } from "@lucide/svelte";
	import type { GrammarState, ThemedToken } from "@shikijs/types";
	import { onMount } from "svelte";
	import { SvelteMap } from "svelte/reactivity";
	import type { ShikiHighlighter } from "./highlighter";
	import { ensureHighlighter, ensureLanguageLoaded, LANGUAGE_ALIASES } from "./highlighter";

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
	let isCollapsed = $state(preferencesSettings.autoHideCode);
	let showSvgPreview = $state(false);
	let isSvgCode = $state(false);
	let isHtmlCode = $state(false);

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
		const trimmed = code.trim();
		return trimmed.startsWith("<svg") || (trimmed.startsWith("<?xml") && trimmed.includes("<svg"));
	};

	const detectHtml = (code: string, language: string | null): boolean => {
		const htmlLanguages = ["html", "htm", "xhtml", "xml"];
		if (language && htmlLanguages.includes(language.toLowerCase())) {
			return true;
		}

		const trimmed = code.trim();
		const htmlTagRegex =
			/<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>(.*?)<\/\1>|<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/>/s;
		return htmlTagRegex.test(trimmed);
	};

	const toggleCollapse = () => {
		isCollapsed = !isCollapsed;
	};

	const toggleSvgPreview = () => {
		showSvgPreview = !showSvgPreview;
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

		const pieces = (lastChunk + chunk).split("\n");
		for (let index = 0; index < pieces.length; index += 1) {
			const piece = pieces[index];
			const isLast = index === pieces.length - 1;
			const result = highlighter.codeToTokens(piece, {
				lang: resolvedLanguage as never,
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
			ensureLanguageLoaded(effectiveLang).catch((error) => {
				console.warn(`Failed to load language ${effectiveLang}:`, error);
			});
			return true;
		}
		return false;
	};

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
					lang: resolvedLanguage as never,
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
	});
</script>

{#if !highlighter}
	{#if props.code.trim()}
		<div class="rounded-xl overflow-hidden border border-border my-7 bg-card">
			<div
				class="flex justify-between items-center px-4 py-2 bg-muted border-b border-border min-h-10"
			>
				<span class="text-sm font-medium text-muted-foreground select-none">Text</span>
				<div class="flex items-center gap-1">
					<CopyButton content={props.code} position="bottom" />
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
{:else if props.code.trim() && lines.length > 0}
	<div class="rounded-xl overflow-hidden border border-border my-7 bg-card">
		<div
			class="flex justify-between items-center px-4 py-2 bg-muted border-b border-border min-h-10"
		>
			<span class="text-sm font-medium text-muted-foreground select-none"
				>{formatLanguageName(resolvedLanguage)}</span
			>
			<div class="flex items-center gap-1">
				<CopyButton content={props.code} position="bottom" />
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
