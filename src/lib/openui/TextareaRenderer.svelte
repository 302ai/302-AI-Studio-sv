<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import Textarea from "$lib/components/ui/textarea/textarea.svelte";

	type OpenUITextareaProps = {
		class?: string;
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		name?: string;
		rows?: number;
		required?: boolean;
	};

	let { props }: ComponentRenderProps<OpenUITextareaProps> = $props();
</script>

<Textarea {...props} />
