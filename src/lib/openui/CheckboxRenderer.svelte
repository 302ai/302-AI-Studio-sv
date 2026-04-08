<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import Checkbox from "$lib/components/ui/checkbox/checkbox.svelte";
	import type { Checkbox as CheckboxPrimitive } from "bits-ui";

	type OpenUICheckboxProps = Pick<
		CheckboxPrimitive.RootProps,
		"checked" | "indeterminate" | "disabled" | "required" | "name" | "value"
	> & {
		class?: string;
	};

	let { props }: ComponentRenderProps<OpenUICheckboxProps> = $props();
</script>

<Checkbox {...props} />
