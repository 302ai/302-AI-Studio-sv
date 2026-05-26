<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import Input from "$lib/components/ui/input/input.svelte";

	type OpenUIInputProps = {
		class?: string;
		type?: "text" | "email" | "password" | "number" | "search" | "url" | "tel" | "file";
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		name?: string;
		required?: boolean;
	};

	let { props }: ComponentRenderProps<OpenUIInputProps> = $props();
</script>

<Input {...props} />
