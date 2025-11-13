<script lang="ts">
	import { m } from "$lib/paraglide/messages";
	import CodeBlock from "../code-block.svelte";

	interface Props {
		blockId: string;
		filePath: string;
		code: string;
		language: string | null;
		theme?: string;
		messageId?: string;
		messagePartIndex?: number;
	}

	const props: Props = $props();
</script>

<!-- File path display -->
<div class="my-2 flex items-center gap-2">
	<span class="text-xs font-medium text-muted-foreground">{m.write()}:</span>
	<span class="text-xs font-mono text-foreground bg-muted px-2 py-0.5 rounded"
		>{props.filePath}</span
	>
</div>
<CodeBlock
	blockId={props.blockId}
	code={props.code}
	language={props.language}
	meta={null}
	theme={props.theme}
	messageId={props.messageId}
	messagePartIndex={props.messagePartIndex}
/>
