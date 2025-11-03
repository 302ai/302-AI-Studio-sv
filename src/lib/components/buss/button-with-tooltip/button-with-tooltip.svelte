<script lang="ts" module>
	import type { ButtonSize, ButtonVariant } from "$lib/components/ui/button/index.js";
	import { type Snippet } from "svelte";

	export interface ButtonWithTooltipProps {
		tooltip: string;
		tooltipSide?: "top" | "right" | "bottom" | "left";
		variant?: ButtonVariant;
		size?: ButtonSize;
		class?: string;
		style?: string;
		disabled?: boolean;
		onclick?: (event: MouseEvent) => void;
		children?: Snippet;
		onOpenChange?: (open: boolean) => void;
		delayDuration?: number;
	}
</script>

<script lang="ts">
	import { buttonVariants } from "$lib/components/ui/button";
	import {
		Tooltip,
		TooltipContent,
		TooltipProvider,
		TooltipTrigger,
	} from "$lib/components/ui/tooltip/index.js";
	import { cn } from "$lib/utils.js";

	const {
		tooltip,
		tooltipSide = "top",
		variant = "ghost",
		size = "icon",
		class: className,
		style,
		disabled,
		onclick,
		children,
		onOpenChange,
		delayDuration = 500,
	}: ButtonWithTooltipProps = $props();

	const buttonClass = $derived(cn(buttonVariants({ variant, size }), className));
</script>

<TooltipProvider {delayDuration}>
	<Tooltip {onOpenChange} ignoreNonKeyboardFocus={true}>
		<TooltipTrigger class={cn(buttonClass, "group rounded-[10px]")} {disabled} {onclick} {style}>
			{@render children?.()}
		</TooltipTrigger>
		<TooltipContent
			side={tooltipSide}
			class="bg-overlay text-overlay-foreground rounded-[10px] border px-2.5 py-1.5 text-sm/6"
			arrowClasses="hidden"
			sideOffset={5}
		>
			{tooltip}
		</TooltipContent>
	</Tooltip>
</TooltipProvider>
