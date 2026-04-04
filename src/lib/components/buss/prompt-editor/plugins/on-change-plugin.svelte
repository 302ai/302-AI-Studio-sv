<script lang="ts">
	import { getEditor } from "svelte-lexical";
	import { onMount } from "svelte";

	interface Props {
		onChange: () => void;
		ignoreSelectionChange?: boolean;
	}

	let { onChange, ignoreSelectionChange = true }: Props = $props();

	const editor = getEditor();

	onMount(() => {
		return editor.registerUpdateListener(
			({ dirtyElements, dirtyLeaves, prevEditorState: _ }) => {
				if (ignoreSelectionChange && dirtyElements.size === 0 && dirtyLeaves.size === 0) {
					return;
				}
				onChange();
			},
		);
	});
</script>
