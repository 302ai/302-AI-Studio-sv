<script lang="ts">
	let { children } = $props();
</script>

<div
	class="mx-auto flex h-full max-w-settings-layout min-w-settings-layout flex-col gap-4 pt-settings-layout-pt"
>
	{@render children()}
</div>
