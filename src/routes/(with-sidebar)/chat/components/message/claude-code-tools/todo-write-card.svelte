<script lang="ts" module>
	import type { DynamicToolUIPart } from "ai";

	interface Todo {
		content: string;
		status: "pending" | "in_progress" | "completed";
		activeForm: string;
	}

	export interface TodoWriteCardProps {
		part: DynamicToolUIPart;
		messageId: string;
	}
</script>

<script lang="ts">
	import { m } from "$lib/paraglide/messages.js";
	import { cn } from "$lib/utils";
	import {
		ArrowRight,
		Ban,
		Check,
		Circle,
		CircleCheck,
		ListTodo,
		LoaderCircle,
	} from "@lucide/svelte";

	let { part, messageId: _messageId }: TodoWriteCardProps = $props();

	// Extract todos from input
	const todos = $derived((): Todo[] => {
		const input = part.input as { todos?: Todo[] } | undefined;
		return input?.todos ?? [];
	});

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
</script>

<div class="mb-3 rounded-[10px] bg-white px-3.5 py-3 dark:bg-[#1A1A1A]">
	<!-- Header -->
	<div class="flex w-full items-center justify-between gap-x-4 mb-3">
		<!-- Left: Tool Icon and Name -->
		<div class="flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
				<ListTodo class="h-5 w-5" />
			</div>

			<h3 class="text-sm font-medium text-foreground">
				{m.todo_list_title()}
			</h3>
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

	{#if todos().length > 0}
		<div class="space-y-1.5 border-t border-border pt-3">
			{#each todos() as todo, index (index)}
				<div class="flex items-center gap-2.5">
					{#if todo.status === "completed"}
						<div
							class="flex h-5 w-5 items-center justify-center rounded-full bg-[#38B865]/10"
						>
							<Check class="h-3.5 w-3.5 text-[#38B865]" />
						</div>
					{:else if todo.status === "in_progress"}
						<div
							class="flex h-5 w-5 items-center justify-center rounded-full bg-[#0056FE]/10"
						>
							<ArrowRight class="h-3.5 w-3.5 text-[#0056FE]" />
						</div>
					{:else}
						<div class="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
							<Circle class="h-3.5 w-3.5 text-muted-foreground" />
						</div>
					{/if}

					<span
						class={cn(
							"text-sm",
							todo.status === "completed"
								? "text-muted-foreground line-through"
								: todo.status === "in_progress"
									? "text-foreground font-medium"
									: "text-foreground",
						)}
					>
						{todo.status === "in_progress" ? todo.activeForm : todo.content}
					</span>
				</div>
			{/each}
		</div>
	{/if}

	{#if part.state === "output-error" && part.errorText}
		<div
			class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950"
		>
			<p class="text-xs text-red-900 dark:text-red-100">{part.errorText}</p>
		</div>
	{/if}
</div>
