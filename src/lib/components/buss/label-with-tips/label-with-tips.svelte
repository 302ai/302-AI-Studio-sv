<script lang="ts">
	import { Label } from "$lib/components/ui/label";
	import * as Tooltip from "$lib/components/ui/tooltip";
	import { cn } from "$lib/utils";
	import { CircleQuestionMark } from "@lucide/svelte";

	interface Props {
		label: string;
		tips: string;
		tooltipPlacement?: "top" | "bottom" | "left" | "right";
		class?: string;
	}

	let { label, tips, tooltipPlacement = "right", class: className }: Props = $props();
	let open = $state(false);

	function handleClick(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		open = !open;
	}
</script>

<div class="flex flex-row items-center gap-x-1" data-slot="label">
	<Label class="text-label-fg">{label}</Label>
	<Tooltip.Provider>
		<Tooltip.Root bind:open disableHoverableContent={true}>
			<Tooltip.Trigger onclick={handleClick}>
				<CircleQuestionMark class="h-3 w-3 text-label-fg cursor-pointer" />
			</Tooltip.Trigger>

			<Tooltip.Content
				class={cn(
					"rounded-[10px] border bg-overlay p-0 text-sm/6 text-overlay-foreground",
					className,
				)}
				side={tooltipPlacement}
				arrowClasses="hidden"
				sideOffset={5}
			>
				<div class="max-w-[300px] min-w-[200px] px-2.5 py-1.5 text-left break-words">
					{tips}
				</div>
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
</div>
