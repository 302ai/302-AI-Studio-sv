<script lang="ts">
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import { m } from "$lib/paraglide/messages";

	interface Props {
		onCopy?: () => void | Promise<void>;
		onEdit?: () => void | Promise<void>;
		onDelete?: () => void | Promise<void>;
		children: import("svelte").Snippet;
	}

	let { onCopy, onEdit, onDelete, children }: Props = $props();

	// 判断是否需要显示分隔线（在主要操作和删除操作之间）
	const shouldShowSeparator = $derived((onCopy || onEdit) && onDelete);
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

		{#if onEdit}
			<ContextMenu.Item onSelect={onEdit}>
				{m.title_edit()}
			</ContextMenu.Item>
		{/if}

		{#if shouldShowSeparator}
			<ContextMenu.Separator />
		{/if}

		{#if onDelete}
			<ContextMenu.Item onSelect={onDelete}>删除</ContextMenu.Item>
		{/if}
	</ContextMenu.Content>
</ContextMenu.Root>
