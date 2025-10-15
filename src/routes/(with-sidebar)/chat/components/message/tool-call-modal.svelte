<script lang="ts" module>
	import type { DynamicToolUIPart } from "ai";

	export interface ToolCallModalProps {
		part: DynamicToolUIPart;
		open: boolean;
		onOpenChange: (open: boolean) => void;
	}
</script>

<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
	} from "$lib/components/ui/dialog/index.js";
	import { m } from "$lib/paraglide/messages.js";

	let { part, open = $bindable(), onOpenChange }: ToolCallModalProps = $props();

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
</script>

<Dialog {open} {onOpenChange}>
	<DialogContent class="max-w-6xl">
		<DialogHeader class="hidden">
			<DialogTitle></DialogTitle>
		</DialogHeader>

		<!-- Header with tool name and status -->
		<div class="mb-6 flex items-center justify-between px-6 pt-4">
			<div>
				<h3 class="text-lg font-medium text-foreground">
					{part.toolName}
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
		<div class="grid grid-cols-2 gap-6 px-6">
			<!-- Left Column: Parameters -->
			<div class="h-[400px] overflow-auto rounded-lg border border-border bg-muted/50">
				<div class="sticky top-0 border-b border-border bg-background px-4 py-2">
					<p class="text-sm font-medium text-muted-foreground">{m.tool_call_parameters()}</p>
				</div>
				<pre class="p-4 text-xs"><code>{formatJson(part.input)}</code></pre>
			</div>

			<!-- Right Column: Result -->
			<div class="h-[400px] overflow-auto rounded-lg border border-border bg-muted/50">
				{#if part.state === "output-available"}
					<div class="sticky top-0 border-b border-border bg-background px-4 py-2">
						<p class="text-sm font-medium text-[#38B865]">{m.tool_call_result()}</p>
					</div>
					<pre class="bg-green-50 p-4 text-xs dark:bg-green-950/30"><code
							>{formatJson(part.output)}</code
						></pre>
				{:else if part.state === "output-error"}
					<div class="sticky top-0 border-b border-border bg-background px-4 py-2">
						<p class="text-sm font-medium text-[#D82525]">{m.tool_call_error_message()}</p>
					</div>
					<div
						class="whitespace-pre-wrap bg-red-50 p-4 text-xs text-red-900 dark:bg-red-950/30 dark:text-red-100"
					>
						{part.errorText}
					</div>
				{:else if part.state === "input-available" || part.state === "input-streaming"}
					<div class="flex h-full items-center justify-center">
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
					<div class="flex h-full items-center justify-center">
						<p class="text-sm text-muted-foreground">{m.tool_call_no_result()}</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Footer -->
		<div class="flex w-full items-center justify-center gap-3 px-6 py-4">
			<Button variant="outline" class="h-[42px] w-[148px]" onclick={() => onOpenChange(false)}>
				{m.tool_call_close()}
			</Button>
		</div>
	</DialogContent>
</Dialog>
