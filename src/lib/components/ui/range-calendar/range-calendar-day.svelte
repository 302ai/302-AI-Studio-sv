<script lang="ts">
	import { RangeCalendar as RangeCalendarPrimitive } from "bits-ui";
	import { buttonVariants } from "$lib/components/ui/button/index.js";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: RangeCalendarPrimitive.DayProps = $props();
</script>

<RangeCalendarPrimitive.Day
	bind:ref
	class={cn(
		buttonVariants({ variant: "ghost" }),
		"flex size-(--cell-size) flex-col items-center justify-center gap-1 p-0 leading-none font-normal whitespace-nowrap select-none",
		"data-[range-middle]:rounded-none [&[data-today]:not([data-selected])]:bg-accent [&[data-today]:not([data-selected])]:text-accent-foreground [&[data-today][data-disabled]]:text-muted-foreground",

		"data-[range-start]:bg-primary data-[range-start]:text-primary-foreground dark:data-[range-start]:hover:bg-accent",

		"data-[range-end]:bg-primary data-[range-end]:text-primary-foreground dark:data-[range-end]:hover:bg-accent",

		"[&[data-outside-month]:not([data-selected])]:text-muted-foreground [&[data-outside-month]:not([data-selected])]:hover:text-accent-foreground",

		"data-[disabled]:pointer-events-none data-[disabled]:text-muted-foreground data-[disabled]:opacity-50",

		"data-[unavailable]:line-through",
		"dark:data-[range-middle]:hover:bg-accent/0",

		"dark:hover:text-accent-foreground",

		"focus:relative focus:border-ring focus:ring-ring/50",

		"[&>span]:text-xs [&>span]:opacity-70",
		className,
	)}
	{...restProps}
/>
