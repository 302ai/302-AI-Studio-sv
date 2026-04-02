<script lang="ts">
	import { uploadToWebserve, validate302Provider } from "$lib/api/webserve-deploy";
	import {
		ensureHighlighter,
		ensureLanguageLoaded,
		LANGUAGE_ALIASES,
	} from "$lib/components/buss/markdown/highlighter";
	import { Button } from "$lib/components/ui/button";
	import { Checkbox } from "$lib/components/ui/checkbox";
	import * as Dialog from "$lib/components/ui/dialog";
	import { Input } from "$lib/components/ui/input";
	import * as Select from "$lib/components/ui/select";
	import { m } from "$lib/paraglide/messages.js";
	import { chatParameters } from "$lib/stores/chat-paramters/chat-parameters.svelte";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { Copy, ExternalLink } from "@lucide/svelte";
	import { format } from "date-fns";
	import katex from "katex";
	import markdownIt from "markdown-it";
	import texmath from "markdown-it-texmath";
	import { toast } from "svelte-sonner";
	import { SvelteSet } from "svelte/reactivity";
	import ExportMessageList from "./export-message-list.svelte";
	import { htmlExportUtils, KATEX_MACROS } from "./html-export-utils.svelte";
	import { createLogger } from "@shared/logger";

	const logger = createLogger("ui");

	// ============================================================================
	// Types
	// ============================================================================

	type ExportFormat = "markdown" | "text" | "json" | "html" | "link";

	interface ExportDialogProps {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		startFromMessageId?: string | null;
	}

	// ============================================================================
	// Props & State
	// ============================================================================

	let {
		open = $bindable(),
		onOpenChange,
		startFromMessageId = null,
	}: ExportDialogProps = $props();

	let exportFormat = $state<ExportFormat>("markdown");
	let selectedMessageIds = new SvelteSet<string>();
	let includeSystemPrompt = $state(true);
	let includeThinking = $state(false);
	let isExporting = $state(false);
	let shareDialogOpen = $state(false);
	let shareUrl = $state("");

	// ============================================================================
	// Derived State
	// ============================================================================

	const hasSystemPrompt = $derived(!!getSystemPrompt()?.trim());
	const selectedCount = $derived(
		selectedMessageIds.size + (includeSystemPrompt && hasSystemPrompt ? 1 : 0),
	);
	const formatOptions = $derived([
		{ value: "markdown", label: "Markdown" },
		{ value: "text", label: m.export_format_plain_text() },
		{ value: "json", label: "JSON" },
		{ value: "html", label: m.export_format_html() },
		{ value: "link", label: m.export_format_link() },
	]);
	const messages = $derived.by(() => {
		if (!open) return [];
		return getFilteredMessages();
	});

	// ============================================================================
	// Effects
	// ============================================================================

	$effect(() => {
		if (open) {
			const filteredMsgs = getFilteredMessages();
			selectedMessageIds.clear();
			for (const msg of filteredMsgs) {
				selectedMessageIds.add(msg.id);
			}
			includeSystemPrompt = hasSystemPrompt;
		}
	});

	// ============================================================================
	// Message Helpers
	// ============================================================================

	function getFilteredMessages() {
		const allMessages = chatState.messages;
		if (!startFromMessageId) return allMessages;

		const assistantIndex = allMessages.findIndex((m) => m.id === startFromMessageId);
		if (assistantIndex === -1) return allMessages;

		return allMessages.slice(0, assistantIndex + 1);
	}

	function getSystemPrompt() {
		const msgs = getFilteredMessages();
		const lastAssistantMsgWithPrompt = [...msgs]
			.reverse()
			.find((m) => m.role === "assistant" && m.metadata?.systemPromptContent);
		if (lastAssistantMsgWithPrompt?.metadata?.systemPromptContent) {
			return lastAssistantMsgWithPrompt.metadata.systemPromptContent;
		}
		return chatParameters.systemPromptContent;
	}

	function getMessageContent(message: (typeof messages)[0], withThinking: boolean): string {
		const textParts = message.parts.filter((p) => p.type === "text");
		const reasoningParts = message.parts.filter((p) => p.type === "reasoning");
		const textContent = textParts.map((p) => p.text).join("\n");

		if (withThinking && reasoningParts.length > 0) {
			const thinkingContent = reasoningParts.map((p) => p.text).join("\n");
			return `${thinkingContent}\n\n${textContent}`;
		}

		return textContent;
	}

	function getRoleLabel(role: string): string {
		const labels: Record<string, string> = {
			user: "User",
			assistant: "Assistant",
			system: "System",
		};
		return labels[role] || role;
	}

	// ============================================================================
	// Selection Actions
	// ============================================================================

	function selectAll() {
		selectedMessageIds.clear();
		for (const msg of messages) {
			selectedMessageIds.add(msg.id);
		}
		if (hasSystemPrompt) includeSystemPrompt = true;
	}

	function invertSelection() {
		const newSelection = new SvelteSet<string>();
		for (const msg of messages) {
			if (!selectedMessageIds.has(msg.id)) {
				newSelection.add(msg.id);
			}
		}
		selectedMessageIds.clear();
		for (const id of newSelection) {
			selectedMessageIds.add(id);
		}
		if (hasSystemPrompt) includeSystemPrompt = !includeSystemPrompt;
	}

	function toggleMessage(id: string) {
		if (selectedMessageIds.has(id)) {
			selectedMessageIds.delete(id);
		} else {
			selectedMessageIds.add(id);
		}
	}

	function toggleSystemPrompt() {
		includeSystemPrompt = !includeSystemPrompt;
	}

	// ============================================================================
	// Export Formatters - Markdown/Text/JSON
	// ============================================================================

	function formatAsMarkdown(): string {
		const lines: string[] = [];
		const systemPrompt = getSystemPrompt();

		if (includeSystemPrompt && hasSystemPrompt) {
			lines.push("## System\n");
			lines.push(systemPrompt + "\n");
		}

		for (const msg of messages) {
			if (!selectedMessageIds.has(msg.id)) continue;

			const role = getRoleLabel(msg.role);
			const content = getMessageContent(msg, false);
			lines.push(`## ${role}\n`);

			if (includeThinking && msg.role === "assistant") {
				const reasoningParts = msg.parts.filter((p) => p.type === "reasoning");
				if (reasoningParts.length > 0) {
					const thinking = reasoningParts.map((p) => p.text).join("\n");
					lines.push("<think>");
					lines.push(thinking);
					lines.push("</think>\n");
				}
			}

			lines.push(content + "\n");
		}

		return lines.join("\n");
	}

	function formatAsText(): string {
		const lines: string[] = [];
		const systemPrompt = getSystemPrompt();

		if (includeSystemPrompt && hasSystemPrompt) {
			lines.push("[System]");
			lines.push(systemPrompt);
			lines.push("");
		}

		for (const msg of messages) {
			if (!selectedMessageIds.has(msg.id)) continue;

			const role = getRoleLabel(msg.role);
			const content = getMessageContent(msg, false);
			lines.push(`[${role}]`);

			if (includeThinking && msg.role === "assistant") {
				const reasoningParts = msg.parts.filter((p) => p.type === "reasoning");
				if (reasoningParts.length > 0) {
					const thinking = reasoningParts.map((p) => p.text).join("\n");
					lines.push("<think>");
					lines.push(thinking);
					lines.push("</think>");
				}
			}

			lines.push(content);
			lines.push("");
		}

		return lines.join("\n");
	}

	function formatAsJson(): string {
		const result: { role: string; content: string }[] = [];
		const systemPrompt = getSystemPrompt();

		if (includeSystemPrompt && hasSystemPrompt) {
			result.push({ role: "system", content: systemPrompt });
		}

		for (const msg of messages) {
			if (!selectedMessageIds.has(msg.id)) continue;
			const content = getMessageContent(msg, includeThinking);
			result.push({ role: msg.role, content });
		}

		return JSON.stringify({ messages: result }, null, 2);
	}

	// ============================================================================
	// HTML Export - Main Function
	// ============================================================================

	async function formatAsHtml(): Promise<string> {
		const { isDark, theme, colors } = htmlExportUtils;
		const systemPrompt = getSystemPrompt();
		const styles = htmlExportUtils.getStyles(colors, isDark);

		// Initialize shiki highlighter
		const highlighter = await ensureHighlighter();

		// Collect and preload all code block languages
		const codeBlockLangs = new SvelteSet<string>();
		for (const msg of messages) {
			if (!selectedMessageIds.has(msg.id)) continue;
			const content = getMessageContent(msg, false);
			const matches = content.matchAll(/```(\w+)?/g);
			for (const match of matches) {
				const lang = match[1] || "plaintext";
				const normalizedLang = LANGUAGE_ALIASES[lang.toLowerCase()] || lang.toLowerCase();
				codeBlockLangs.add(normalizedLang);
			}
		}

		for (const lang of codeBlockLangs) {
			await ensureLanguageLoaded(lang);
		}

		// Configure markdown-it with texmath
		const md = markdownIt({ html: true, linkify: true, breaks: true });

		md.renderer.rules.fence = (tokens, idx) => {
			const token = tokens[idx];
			const code = token.content;
			const info = token.info ? token.info.trim() : "";
			const rawLang = info.split(/\s+/)[0] || "plaintext";
			const lang = LANGUAGE_ALIASES[rawLang.toLowerCase()] || rawLang.toLowerCase();
			const langDisplay = htmlExportUtils.formatLanguageName(rawLang);

			let highlightedCode: string;
			try {
				highlightedCode = highlighter.codeToHtml(code, {
					lang: lang as never,
					theme: theme ?? "vitesse-light",
				});
			} catch {
				const escapedCode = code
					.replace(/&/g, "&amp;")
					.replace(/</g, "&lt;")
					.replace(/>/g, "&gt;");
				highlightedCode = `<pre><code>${escapedCode}</code></pre>`;
			}

			return `<div class="code-block-wrapper">
				<div class="code-block-header">
					<span class="code-block-lang">${langDisplay}</span>
				</div>
				${highlightedCode}
			</div>`;
		};

		md.use(texmath, {
			engine: katex,
			delimiters: ["dollars", "brackets"],
			katexOptions: {
				throwOnError: false,
				errorColor: "#cc0000",
				displayMode: false,
				fleqn: false,
				leqno: false,
				minRuleThickness: 0.04,
				maxSize: Infinity,
				maxExpand: 1000,
				trust: true,
				strict: false,
				output: "html",
				macros: KATEX_MACROS,
			},
		});

		// Build message elements
		const messageElements: string[] = [];

		if (includeSystemPrompt && hasSystemPrompt) {
			messageElements.push(`
				<div class="message system">
					<div class="system-label">System</div>
					<div class="message-content">${htmlExportUtils.escapeHtml(systemPrompt)}</div>
				</div>
			`);
		}

		for (const msg of messages) {
			if (!selectedMessageIds.has(msg.id)) continue;

			if (msg.role === "user") {
				const textContent = getMessageContent(msg, false);
				messageElements.push(`
					<div class="message user">
						<div class="message-content">${htmlExportUtils.escapeHtml(textContent)}</div>
					</div>
				`);
			} else if (msg.role === "assistant") {
				const modelName = msg.metadata?.model || "AI";
				const modelIconUrl = htmlExportUtils.getModelIconUrl(modelName);
				let contentHtml = "";

				if (includeThinking) {
					const reasoningParts = msg.parts.filter((p) => p.type === "reasoning");
					if (reasoningParts.length > 0) {
						const thinkingText = reasoningParts.map((p) => p.text).join("\n");
						contentHtml += `
							<div class="thinking">
								<div class="thinking-header">
									<svg class="thinking-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
										<path d="M9 18h6"/>
										<path d="M10 22h4"/>
									</svg>
									<span class="thinking-label">${m.title_thinking()}</span>
								</div>
								<div class="thinking-content">${htmlExportUtils.escapeHtml(thinkingText)}</div>
							</div>
						`;
					}
				}

				const textContent = getMessageContent(msg, false);
				contentHtml += `<div class="prose">${md.render(textContent)}</div>`;

				messageElements.push(`
					<div class="message assistant">
						<div class="model-header">
							<img class="model-icon" src="${modelIconUrl}" alt="${htmlExportUtils.escapeHtmlAttr(modelName)}" />
							<span class="model-name">${htmlExportUtils.escapeHtmlAttr(modelName)}</span>
						</div>
						<div class="message-content">${contentHtml}</div>
					</div>
				`);
			}
		}

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Chat Export</title>
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css" crossorigin="anonymous">
	<style>${styles}</style>
</head>
<body>
	<div class="container">
		${messageElements.join("\n")}
	</div>
</body>
</html>`;
	}

	// ============================================================================
	// Export Handler
	// ============================================================================

	function handleOpenLink() {
		window.electronAPI?.externalLinkService.openExternalLink(shareUrl);
	}

	async function handleCopyLink() {
		try {
			await navigator.clipboard.writeText(shareUrl);
			toast.success(m.toast_copied_success());
		} catch {
			toast.error(m.toast_copied_failed());
		}
	}

	async function handleExport() {
		if (selectedCount === 0) {
			toast.error(m.export_at_least_one_message());
			return;
		}

		isExporting = true;

		try {
			// Handle link export separately (upload to webserve)
			if (exportFormat === "link") {
				const htmlContent = await formatAsHtml();
				const htmlFile = new File([htmlContent], "chat-export.html", { type: "text/html" });

				const validation = validate302Provider(persistedProviderState.current);
				if (!validation.valid) {
					const errorKey = validation.error;
					const messages = m as unknown as Record<string, () => string>;
					toast.error(messages[errorKey]?.() || errorKey);
					return;
				}

				const result = await uploadToWebserve(validation.provider, {
					file: htmlFile,
					add_watermarks: true,
				});

				if (result.success && result.data) {
					shareUrl = result.data.url;
					shareDialogOpen = true;
				} else {
					toast.error(result.error || m.export_upload_failed());
				}
				return;
			}

			// Handle file export formats
			let content: string;
			let extension: string;
			let filterName: string;

			switch (exportFormat) {
				case "markdown":
					content = formatAsMarkdown();
					extension = "md";
					filterName = "Markdown";
					break;
				case "text":
					content = formatAsText();
					extension = "txt";
					filterName = "Text";
					break;
				case "json":
					content = formatAsJson();
					extension = "json";
					filterName = "JSON";
					break;
				case "html":
					content = await formatAsHtml();
					extension = "html";
					filterName = "HTML";
					break;
			}

			const timestamp = format(new Date(), "yyyyMMddHHmmss");
			const defaultFileName = `chat-export-${timestamp}.${extension}`;

			const filePath = await window.electronAPI.dataService.exportChatToFile(
				content,
				extension,
				filterName,
				defaultFileName,
			);

			if (filePath) {
				toast.success(m.export_success());
				open = false;
			}
		} catch (error) {
			logger.error("Export failed:", error);
			toast.error(m.export_failed());
		} finally {
			isExporting = false;
		}
	}
</script>

<Dialog.Root bind:open {onOpenChange}>
	<Dialog.Content class="!w-[638px] !min-w-[638px] !max-w-[638px] !h-[540px] flex flex-col">
		<Dialog.Header>
			<Dialog.Title>{m.export_dialog_title()}</Dialog.Title>
		</Dialog.Header>

		<!-- Format Select -->
		<div class="mt-2">
			<Select.Root type="single" bind:value={exportFormat}>
				<Select.Trigger class="w-full">
					<span>{formatOptions.find((o) => o.value === exportFormat)?.label}</span>
				</Select.Trigger>
				<Select.Content>
					{#each formatOptions as option (option.value)}
						<Select.Item value={option.value} label={option.label}>
							{option.label}
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>

		<!-- Selection Header -->
		<div class="mt-4 flex items-center justify-between">
			<div class="flex items-baseline gap-2">
				<span class="font-medium">{m.export_select_range()}</span>
				<span class="text-sm text-muted-foreground"
					>{m.export_selected_count({ count: selectedCount })}</span
				>
			</div>
			<div class="flex items-center gap-1">
				<Button variant="ghost" size="sm" class="text-primary" onclick={selectAll}>
					{m.export_select_all()}
				</Button>
				<Button variant="ghost" size="sm" class="text-primary" onclick={invertSelection}>
					{m.export_invert_selection()}
				</Button>
			</div>
		</div>

		<!-- Message List -->
		<div class="mt-2 flex-1 overflow-hidden">
			<ExportMessageList
				{messages}
				selectedIds={selectedMessageIds}
				systemPrompt={getSystemPrompt()}
				{hasSystemPrompt}
				{includeSystemPrompt}
				onToggleMessage={toggleMessage}
				onToggleSystemPrompt={toggleSystemPrompt}
			/>
		</div>

		<!-- Footer -->
		<div class="mt-4 flex items-center justify-between">
			<label class="flex items-center gap-2 cursor-pointer">
				<Checkbox bind:checked={includeThinking} />
				<span class="text-sm">{m.export_include_thinking()}</span>
			</label>
			<Button onclick={handleExport} disabled={isExporting || selectedCount === 0}>
				{isExporting ? m.export_exporting() : m.export_button()}
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>

<!-- Share Link Dialog -->
<Dialog.Root bind:open={shareDialogOpen}>
	<Dialog.Content class="min-w-[431px]">
		<Dialog.Header>
			<Dialog.Title>{m.export_share_link_title()}</Dialog.Title>
		</Dialog.Header>

		<Input value={shareUrl} readonly />

		<Dialog.Footer class="flex sm:justify-between">
			<Button variant="outline" onclick={handleOpenLink}>
				<ExternalLink class="size-4" />
				{m.export_open_link()}
			</Button>
			<Button onclick={handleCopyLink}>
				<Copy class="size-4" />
				{m.export_copy_link()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
