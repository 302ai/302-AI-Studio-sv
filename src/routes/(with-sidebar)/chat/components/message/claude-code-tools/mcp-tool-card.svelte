<script lang="ts" module>
	import type { DynamicToolUIPart } from "ai";
	import type { McpToolInfo } from "./utils";

	export interface McpToolCardProps {
		part: DynamicToolUIPart;
		messageId: string;
		mcpToolInfo: McpToolInfo;
	}
</script>

<script lang="ts">
	import StaticCodeBlock from "$lib/components/buss/markdown/static-code-block.svelte";
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
	} from "$lib/components/ui/dialog/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { Ban, Circle, CircleCheck, LoaderCircle, Server } from "@lucide/svelte";

	let { part, messageId: _messageId, mcpToolInfo }: McpToolCardProps = $props();

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

	// 判断是否有输出内容
	const hasOutput = $derived(
		(part.state === "output-available" && part.output) ||
			(part.state === "output-error" && part.errorText),
	);

	const outputContent = $derived.by(() => {
		if (part.state === "output-available" && part.output) {
			if (typeof part.output === "string") {
				return part.output;
			}
			return formatJson(part.output);
		}
		return "";
	});

	const outputLanguage = $derived.by(() => {
		if (typeof part.output === "string") {
			return "plaintext";
		}
		return "json";
	});
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
		<div class="flex items-center gap-3 min-w-0 flex-1">
			<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
				<Server class="h-5 w-5" />
			</div>

			<!-- Tool Name and Server ID -->
			<div class="flex flex-col items-start gap-1 min-w-0">
				<h3 class="text-sm font-medium text-foreground truncate max-w-full">
					{mcpToolInfo.toolName}
				</h3>
				<p class="text-xs text-muted-foreground truncate max-w-full">
					{mcpToolInfo.serverId}
				</p>
			</div>
		</div>

		<!-- Right: Status -->
		<div class="flex items-center gap-2 shrink-0">
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
				<Server class="h-5 w-5" />
				<span>{mcpToolInfo.toolName}</span>
				<span class="text-xs text-muted-foreground">({mcpToolInfo.serverId})</span>
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
							class="h-full [&_.shiki]:overflow-y-auto [&_.shiki]:overflow-x-hidden [&_.shiki]:text-xs [&_.shiki_code]:whitespace-pre-wrap [&_.shiki_code]:break-all"
						>
							<StaticCodeBlock
								code={outputContent}
								language={outputLanguage}
								canCollapse={false}
								title={m.tool_call_result()}
								showCollapseButton={false}
							/>
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
