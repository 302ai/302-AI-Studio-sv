<!-- eslint-disable svelte/no-at-html-tags -->
<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { CopyButton } from "$lib/components/buss/copy-button";
	import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";
	import { ChevronDown } from "@lucide/svelte";
	import { onMount } from "svelte";
	import type { ShikiHighlighter } from "./highlighter";
	import { DEFAULT_THEME, ensureHighlighter } from "./highlighter";

	interface Props {
		code: string;
		language: string | null;
		theme?: string | null;
		title?: string | null;
		showCollapseButton?: boolean;
	}

	const props: Props = $props();

	let highlighter = $state<ShikiHighlighter | null>(null);
	let highlightedHtml = $state<string>("");
	let isCollapsed = $state(preferencesSettings.autoHideCode);
	let resolvedLanguage = $state("plaintext");
	let resolvedTheme = $state<string>(DEFAULT_THEME);

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
			json: "JSON",
			yaml: "YAML",
			yml: "YAML",
			md: "Markdown",
			markdown: "Markdown",
			sh: "Shell",
			bash: "Bash",
			sql: "SQL",
			java: "Java",
			cpp: "C++",
			c: "C",
			cs: "C#",
			php: "PHP",
			ruby: "Ruby",
			go: "Go",
			rust: "Rust",
			swift: "Swift",
			kotlin: "Kotlin",
			dart: "Dart",
			vue: "Vue",
			svelte: "Svelte",
		};

		return languageNames[lang.toLowerCase()] || lang.charAt(0).toUpperCase() + lang.slice(1);
	};

	const toggleCollapse = () => {
		isCollapsed = !isCollapsed;
	};

	const highlightCode = async () => {
		if (!highlighter || !props.code) {
			highlightedHtml = "";
			return;
		}

		const lang = props.language?.toLowerCase().trim() || "plaintext";
		resolvedLanguage = lang;

		let theme = DEFAULT_THEME as string;
		if (props.theme?.trim()) {
			try {
				const loaded = highlighter.getInternalContext().getLoadedThemes();
				theme = loaded.includes(props.theme.trim()) ? props.theme.trim() : DEFAULT_THEME;
			} catch {
				theme = DEFAULT_THEME;
			}
		}
		resolvedTheme = theme;

		highlightedHtml = highlighter.codeToHtml(props.code, {
			lang: resolvedLanguage as never,
			theme: resolvedTheme,
		});
	};

	onMount(async () => {
		highlighter = await ensureHighlighter();
		await highlightCode();
	});

	$effect(() => {
		if (highlighter && props.code) {
			highlightCode();
		}
	});
</script>

{#if props.code.trim()}
	<div class="rounded-xl overflow-hidden border border-border w-full flex flex-col h-full">
		<div
			class="flex justify-between items-center px-4 py-2 bg-muted border-b border-border min-h-10 flex-shrink-0"
		>
			<span class="text-sm font-medium text-muted-foreground select-none">
				{props.title || formatLanguageName(resolvedLanguage)}
			</span>
			<div class="flex items-center gap-1">
				<CopyButton content={props.code} position="bottom" />
				{#if props.showCollapseButton !== false}
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
				{/if}
			</div>
		</div>
		{#if !isCollapsed}
			<div class="overflow-auto flex-1 min-h-0 w-full">
				{#if highlightedHtml}
					<div class="min-w-full inline-block">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html highlightedHtml}
					</div>
				{:else}
					<pre class="shiki !m-0 !rounded-none !border-0 w-full min-w-full"><code
							class="block min-w-full">{props.code}</code
						></pre>
				{/if}
			</div>
		{/if}
	</div>
{/if}
