<script lang="ts">
	import { markdownToHtml } from "./utils";

	interface Props {
		content: string;
	}

	let { content }: Props = $props();
	let rendered = $state("");

	$effect(() => {
		if (content.trim()) {
			markdownToHtml(content).then((html) => {
				rendered = html;
			});
		} else {
			rendered = "";
		}
	});
</script>

<div class="prose max-w-none">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html rendered}
</div>
