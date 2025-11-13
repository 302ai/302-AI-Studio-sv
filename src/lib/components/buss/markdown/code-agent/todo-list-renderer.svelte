<script lang="ts">
	import { m } from "$lib/paraglide/messages.js";
	import { Check, Circle, CornerDownRight } from "@lucide/svelte";

	interface Todo {
		content: string;
		status: "pending" | "in_progress" | "completed";
		activeForm: string;
	}

	interface Props {
		todos: Todo[];
	}

	let { todos }: Props = $props();
</script>

<div class="my-3 space-y-1">
	<div class="mb-2 flex items-center gap-2">
		<div class="text-sm font-semibold text-foreground">
			{m.todo_list_title()}
		</div>
		<div class="text-xs text-muted-foreground">
			{todos.filter((t) => t.status === "completed").length}/{todos.length}
		</div>
	</div>

	{#each todos as todo, index (index)}
		<div class="flex items-center gap-2">
			{#if todo.status === "completed"}
				<Check class="h-4 w-4 text-muted-foreground" />
			{:else if todo.status === "in_progress"}
				<CornerDownRight class="h-4 w-4 text-muted-foreground" />
			{:else}
				<Circle class="h-4 w-4 text-muted-foreground" />
			{/if}

			<span
				class="text-sm {todo.status === 'completed'
					? 'text-muted-foreground line-through'
					: 'text-foreground'}"
			>
				{todo.status === "in_progress" ? todo.activeForm : todo.content}
			</span>
		</div>
	{/each}
</div>
