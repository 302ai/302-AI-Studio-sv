<script lang="ts">
	interface Props {
		content: string;
	}

	const { content }: Props = $props();
</script>

<div class="prose max-w-none">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html content}
</div>
