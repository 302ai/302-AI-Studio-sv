<script lang="ts">
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import { m } from "$lib/paraglide/messages";

	interface Props {
		onCopy?: () => void | Promise<void>;
		onEdit?: () => void | Promise<void>;
		onRegenerate?: () => void | Promise<void>;
		onCreateBranch?: () => void | Promise<void>;
		onDelete?: () => void | Promise<void>;
		children: import("svelte").Snippet;
	}

	let { onCopy, onEdit, onRegenerate, onCreateBranch, onDelete, children }: Props = $props();
</script>

<ContextMenu.Root>
	<ContextMenu.Trigger>
		{@render children()}
	</ContextMenu.Trigger>

	<ContextMenu.Content>
		{#if onCopy}
			<ContextMenu.Item onSelect={onCopy}>
				{m.common_copy()}
			</ContextMenu.Item>
		{/if}

		<ContextMenu.Separator />

		{#if onEdit}
			<ContextMenu.Item onSelect={onEdit}>
				{m.title_edit()}
			</ContextMenu.Item>
		{/if}

		{#if onRegenerate}
			<ContextMenu.Item onSelect={onRegenerate}>
				{m.title_regenerate()}
			</ContextMenu.Item>
		{/if}

		{#if onCreateBranch}
			<ContextMenu.Item onSelect={onCreateBranch}>
				{m.common_create_branch()}
			</ContextMenu.Item>
		{/if}

		{#if onDelete}
			<ContextMenu.Item onSelect={onDelete}>
				{m.text_button_delete()}
			</ContextMenu.Item>
		{/if}
	</ContextMenu.Content>
</ContextMenu.Root>
