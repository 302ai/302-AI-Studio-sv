<script lang="ts" module>
	import type { DynamicToolUIPart } from "ai";

	export interface SkillCardProps {
		part: DynamicToolUIPart;
		messageId: string;
	}
</script>

<script lang="ts">
	import { CopyButton } from "$lib/components/buss/copy-button";
	import { MarkdownRenderer } from "$lib/components/buss/markdown";
	import StaticCodeBlock from "$lib/components/buss/markdown/static-code-block.svelte";
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
	} from "$lib/components/ui/dialog/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { persistedThemeState } from "$lib/stores/theme.state.svelte";
	import { Ban, Circle, CircleCheck, LoaderCircle, Zap } from "@lucide/svelte";

	let { part, messageId }: SkillCardProps = $props();

	let isModalOpen = $state(false);

	function formatJson(obj: unknown): string {
		try {
			return JSON.stringify(obj, null, 2);
		} catch {
			return String(obj);
		}
	}

	const statusConfig = $derived(() => {
		switch (part.state) {
			case "output-available":
				return {
					icon: CircleCheck,
					color: "text-[#38B865]",
					bgColor: "bg-[#38B865]",
					label: m.tool_call_status_success(),
					animate: false,
				};
			case "output-error":
				return {
					icon: Ban,
					color: "text-[#D82525]",
					bgColor: "bg-[#D82525]",
					label: m.tool_call_status_error(),
					animate: false,
				};
			case "input-available":
				return {
					icon: LoaderCircle,
					color: "text-[#0056FE]",
					bgColor: "bg-[#0056FE]",
					label: m.tool_call_status_executing(),
					animate: true,
				};
			case "input-streaming":
				return {
					icon: Circle,
					color: "text-[#0056FE]",
					bgColor: "bg-[#0056FE]",
					label: m.tool_call_status_preparing(),
					animate: true,
				};
			default:
				return {
					icon: Circle,
					color: "text-muted-foreground",
					bgColor: "bg-muted",
					label: "Unknown",
					animate: false,
				};
		}
	});

	const skillName = $derived.by(() => {
		const input = part.input as { skill?: string } | undefined;
		return input?.skill || "Unknown Skill";
	});

	const outputText = $derived.by(() => {
		if (part.state === "output-available" && part.output) {
			return typeof part.output === "string" ? part.output : formatJson(part.output);
		}
		return "";
	});

	// 判断是否有输出内容
	const hasOutput = $derived(
		(part.state === "output-available" && part.output) ||
			(part.state === "output-error" && part.errorText),
	);
</script>

<!-- Card Button -->
<button
	type="button"
	class="mb-3 block w-full cursor-pointer rounded-[10px] border-0 bg-white px-3.5 py-3 text-left hover:bg-[#F9F9F9] dark:bg-[#1A1A1A] dark:hover:bg-[#2D2D2D]"
	onclick={() => {
		isModalOpen = true;
	}}
>
	<div class="flex w-full items-center justify-between gap-x-4">
		<!-- Left: Tool Icon and Name -->
		<div class="flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
				<Zap class="h-5 w-5" />
			</div>

			<!-- Tool Name -->
			<div class="flex flex-col items-start gap-1">
				<h3 class="text-sm font-medium text-foreground">
					{skillName}
				</h3>
				<p class="text-xs text-muted-foreground">{m.tool_call_label_execute_skill()}</p>
			</div>
		</div>

		<!-- Right: Status -->
		<div class="flex items-center gap-2">
			{#if statusConfig().animate}
				<div class="h-2 w-2 animate-pulse rounded-full {statusConfig().bgColor}"></div>
			{:else}
				<div class="h-2 w-2 rounded-full {statusConfig().bgColor}"></div>
			{/if}
			<span class="text-sm {statusConfig().color}">{statusConfig().label}</span>
		</div>
	</div>
</button>

<!-- Modal Dialog -->
<Dialog bind:open={isModalOpen}>
	<DialogContent
		data-tool-card-dialog
		class="!flex !flex-col !grid-cols-none !gap-0 h-[80vh] w-[60vw]"
	>
		<DialogHeader class="shrink-0 mb-4">
			<DialogTitle class="flex items-center gap-2">
				<Zap class="h-5 w-5" />
				<span>{skillName}</span>
			</DialogTitle>
		</DialogHeader>

		<!-- Input & Output Layout -->
		<div class="flex-1 min-h-0 flex gap-2">
			<!-- Left: Input Parameters -->
			<div class="min-h-0 min-w-0 overflow-y-auto {hasOutput ? 'flex-1 pr-2' : 'w-full'}">
				{#if part.input}
					<div
						class="h-full [&_.shiki]:overflow-y-auto [&_.shiki]:overflow-x-hidden [&_.shiki]:text-xs [&_.shiki_code]:whitespace-pre-wrap [&_.shiki_code]:break-all"
					>
						<StaticCodeBlock
							code={formatJson(part.input)}
							language="json"
							canCollapse={false}
							title={m.tool_call_parameters()}
							showCollapseButton={false}
						/>
					</div>
				{/if}
			</div>

			<!-- Right: Output / Error -->
			{#if hasOutput}
				<div class="flex-1 min-h-0 min-w-0 overflow-y-auto">
					{#if part.state === "output-available" && part.output}
						<div
							class="rounded-xl overflow-hidden border border-border w-full flex flex-col h-full"
						>
							<div
								class="flex justify-between items-center px-4 py-2 bg-muted border-b border-border min-h-10 flex-shrink-0"
							>
								<span class="text-sm font-medium text-muted-foreground select-none">
									{m.tool_call_result()}
								</span>
								<div class="flex items-center gap-1">
									<CopyButton content={outputText} position="bottom" />
								</div>
							</div>
							<div class="flex-1 min-h-0 w-full overflow-y-auto p-4">
								<div class="prose prose-sm dark:prose-invert max-w-none">
									<MarkdownRenderer
										content={outputText}
										{messageId}
										isStreaming={false}
										codeTheme={persistedThemeState.current.shouldUseDarkColors
											? "vitesse-dark"
											: "vitesse-light"}
									/>
								</div>
							</div>
						</div>
					{:else if part.state === "output-error" && part.errorText}
						<div
							class="h-full rounded-lg border border-red-200 bg-red-50 p-4 overflow-y-auto dark:border-red-900 dark:bg-red-950"
						>
							<p class="text-sm font-medium text-[#D82525] mb-2">
								{m.tool_call_error_message()}
							</p>
							<p class="text-xs text-red-900 dark:text-red-100 whitespace-pre-wrap">
								{part.errorText}
							</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</DialogContent>
</Dialog>
