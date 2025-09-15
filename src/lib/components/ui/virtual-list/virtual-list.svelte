<script lang="ts" module>
	import type { Snippet } from "svelte";

	interface Props<T extends { id?: string | number }> {
		items: T[];
		itemHeight: number;
		height: number;
		class?: string;
		item: Snippet<[T, number]>;
	}
</script>

<script lang="ts" generics="T extends { id?: string | number }">
	let { items, itemHeight, height, class: className = "", item }: Props<T> = $props();

	let scrollTop = $state(0);
	const visibleCount = $derived(Math.ceil(height / itemHeight));
	const bufferCount = 3;
	const totalCount = $derived(items.length);
	const startIndex = $derived(Math.max(0, Math.floor(scrollTop / itemHeight) - bufferCount));
	const endIndex = $derived(Math.min(totalCount, startIndex + visibleCount + bufferCount * 2));
	const visibleItems = $derived(items.slice(startIndex, endIndex));
	const totalHeight = $derived(totalCount * itemHeight);
	const offsetY = $derived(startIndex * itemHeight);

	function handleScroll(event: Event) {
		const target = event.target as HTMLDivElement;
		scrollTop = target.scrollTop;
	}
</script>

<div
	class="relative overflow-auto {className}"
	style="height: {height}px; width: 100%; scrollbar-gutter: stable;"
	onscroll={handleScroll}
>
	<!-- 总高度占位符 -->
	<div style="height: {totalHeight}px; position: relative; width: 100%;">
		<!-- 可见项目容器 -->
		<div style="transform: translateY({offsetY}px); width: 100%;">
			{#each visibleItems as itemData, index (itemData.id || startIndex + index)}
				<div style="height: {itemHeight}px; width: 100%;">
					{@render item(itemData, startIndex + index)}
				</div>
			{/each}
		</div>
	</div>
</div>
