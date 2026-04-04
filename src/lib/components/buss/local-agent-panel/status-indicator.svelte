<script lang="ts" module>
	export interface Props {
		status: "gray" | "green" | "red" | "yellow";
		text: string;
		showWarning?: boolean;
		warningTooltip?: string;
		className?: string; // Allow custom class
	}
</script>

<script lang="ts">
	import * as Tooltip from "$lib/components/ui/tooltip/index.js";
	import { cn } from "$lib/utils";
	import { TriangleAlert } from "@lucide/svelte";

	let { status, text, showWarning = false, warningTooltip, className }: Props = $props();

	// Derived classes for status dot
	const statusColorClass = $derived(
		status === "green"
			? "bg-green-500"
			: status === "red"
				? "bg-red-500"
				: status === "yellow"
					? "bg-yellow-500"
					: "bg-muted-foreground", // gray
	);

	const statusIconClass = $derived(
		status === "green"
			? "text-green-600"
			: status === "red"
				? "text-destructive"
				: status === "yellow"
					? "text-yellow-600"
					: "text-muted-foreground",
	);
</script>

<div class={cn("flex items-center gap-2", className)}>
	<span class={cn("size-2 rounded-full", statusColorClass)}></span>
	<span class={cn("text-sm", statusIconClass)}>{text}</span>
	{#if status === "green"}
		<!-- <Circle class="size-3 fill-green-500 text-green-500" />  Optional: extra checkmark/circle if needed, mimicking mockup -->
	{/if}
	{#if showWarning}
		<Tooltip.Root>
			<Tooltip.Trigger>
				<TriangleAlert class="size-4 text-destructive" />
			</Tooltip.Trigger>
			{#if warningTooltip}
				<Tooltip.Content
					class="relative overflow-visible rounded-md border border-border bg-overlay text-overlay-foreground shadow-md"
					arrowClasses="hidden"
					side="top"
					sideOffset={10}
				>
					<p>{warningTooltip}</p>
					<span
						class="pointer-events-none absolute top-full left-1/2 block -translate-x-1/2"
					>
						<span
							class="absolute left-1/2 top-0 block h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[7px] border-x-transparent"
							style="border-top-color: var(--border);"
						></span>
						<span
							class="absolute left-1/2 top-[-1px] block h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent"
							style="border-top-color: var(--overlay);"
						></span>
					</span>
				</Tooltip.Content>
			{/if}
		</Tooltip.Root>
	{/if}
</div>
