<script lang="ts" module>
	import type { DynamicToolUIPart } from "ai";

	export interface ToolCallModalProps {
		part: DynamicToolUIPart;
		messageId: string;
		open: boolean;
		onOpenChange: (open: boolean) => void;
	}
</script>

<script lang="ts">
	import StaticCodeBlock from "$lib/components/buss/markdown/static-code-block.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
	} from "$lib/components/ui/dialog/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { RotateCw } from "@lucide/svelte";
	import { toast } from "svelte-sonner";

	let { part, messageId, open = $bindable(), onOpenChange }: ToolCallModalProps = $props();

	let isRerunning = $state(false);

	function getDisplayToolName(toolName: string): string {
		// Remove server ID prefix from display name
		const parts = toolName.split("__");
		return parts.length >= 2 ? parts.slice(1).join("__") : toolName;
	}

	function getStatusIcon() {
		switch (part.state) {
			case "output-available":
				return '<div class="h-3 w-3 rounded-full bg-[#38B865]"></div>';
			case "output-error":
				return '<div class="h-3 w-3 rounded-full bg-[#D82525]"></div>';
			case "input-available":
			case "input-streaming":
				return '<div class="h-3 w-3 rounded-full bg-[#0056FE]"></div>';
			default:
				return '<div class="h-3 w-3 rounded-full bg-gray-400"></div>';
		}
	}

	function getStatusText() {
		switch (part.state) {
			case "output-available":
				return m.tool_call_status_success();
			case "output-error":
				return m.tool_call_status_error();
			case "input-available":
				return m.tool_call_status_executing();
			case "input-streaming":
				return m.tool_call_status_preparing();
			default:
				return "Unknown";
		}
	}

	function formatJson(obj: unknown): string {
		try {
			return JSON.stringify(obj, null, 2);
		} catch {
			return String(obj);
		}
	}

	async function handleRerun() {
		if (isRerunning) return;

		isRerunning = true;

		const toolCallIdToRerun = part.toolCallId;
		const messageIdToRerun = messageId;

		onOpenChange(false);

		try {
			await chatState.rerunToolCall(messageIdToRerun, toolCallIdToRerun);
			toast.success(m.tool_call_rerun_success());
		} catch (error) {
			console.error("Failed to rerun tool call:", error);
			toast.error(m.tool_call_rerun_error());
		} finally {
			isRerunning = false;
		}
	}
</script>

<Dialog {open} {onOpenChange}>
	<DialogContent class="max-w-6xl">
		<DialogHeader class="hidden">
			<DialogTitle></DialogTitle>
		</DialogHeader>

		<!-- Header with tool name and status -->
		<div class="mb-6 flex items-center justify-between pt-1">
			<div>
				<h3 class="text-lg font-medium text-foreground">
					{getDisplayToolName(part.toolName)}
				</h3>
			</div>

			<div class="flex items-center gap-2">
				{@html getStatusIcon()}
				<span
					class="text-sm {part.state === 'output-available'
						? 'text-[#38B865]'
						: part.state === 'output-error'
							? 'text-[#D82525]'
							: part.state === 'input-available' || part.state === 'input-streaming'
								? 'text-[#0056FE]'
								: 'text-foreground'}"
				>
					{getStatusText()}
				</span>
			</div>
		</div>

		<!-- Two-column layout -->
		<div class="grid grid-cols-2 gap-4">
			<!-- Left Column: Parameters -->
			<div class="flex flex-col gap-2">
				<div class="h-[400px] overflow-hidden">
					<StaticCodeBlock
						blockId={`tool-params-${part.toolCallId}`}
						code={formatJson(part.input)}
						language="json"
						title={m.tool_call_parameters()}
						showCollapseButton={false}
					/>
				</div>
			</div>

			<!-- Right Column: Result -->
			<div class="flex flex-col gap-2">
				{#if part.state === "output-available"}
					<div class="h-[400px] overflow-hidden">
						<StaticCodeBlock
							blockId={`tool-result-${part.toolCallId}`}
							code={formatJson(part.output)}
							language="json"
							title={m.tool_call_result()}
							showCollapseButton={false}
						/>
					</div>
				{:else if part.state === "output-error"}
					<div
						class="h-[400px] overflow-auto rounded-xl border border-border bg-card flex flex-col"
					>
						<div class="flex-shrink-0 px-4 py-2 bg-muted border-b border-border">
							<span class="text-sm font-medium text-[#D82525]">{m.tool_call_error_message()}</span>
						</div>
						<div
							class="flex-1 overflow-auto whitespace-pre-wrap p-4 text-xs text-red-900 dark:text-red-100"
						>
							{part.errorText}
						</div>
					</div>
				{:else if part.state === "input-available" || part.state === "input-streaming"}
					<div
						class="flex h-[400px] items-center justify-center rounded-xl border border-border bg-card"
					>
						<div class="text-center">
							<div class="mx-auto mb-2 h-8 w-8 animate-pulse rounded-full bg-[#0056FE]"></div>
							<p class="text-sm text-[#0056FE]">
								{part.state === "input-streaming"
									? m.tool_call_status_preparing()
									: m.tool_call_status_executing()}
							</p>
						</div>
					</div>
				{:else}
					<div
						class="flex h-[400px] items-center justify-center rounded-xl border border-border bg-card"
					>
						<p class="text-sm text-muted-foreground">{m.tool_call_no_result()}</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Footer -->
		<div class="flex w-full items-center justify-center gap-3 px-6 py-4">
			{#if part.state === "output-available" || part.state === "output-error"}
				<Button
					variant="outline"
					class="h-[42px] w-[148px]"
					onclick={handleRerun}
					disabled={isRerunning}
				>
					<RotateCw class="h-4 w-4 {isRerunning ? 'animate-spin' : ''}" />
					{m.tool_call_rerun()}
				</Button>
			{/if}
			<Button variant="default" class="h-[42px] w-[148px]" onclick={() => onOpenChange(false)}>
				{m.tool_call_close()}
			</Button>
		</div>
	</DialogContent>
</Dialog>
