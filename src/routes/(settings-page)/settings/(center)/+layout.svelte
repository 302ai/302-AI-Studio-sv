<script lang="ts">
	const { children } = $props();
</script>

<div
	class="max-w-settings-layout min-w-settings-layout pt-settings-layout-pt mx-auto flex min-h-full flex-col gap-4 pb-settings-layout-pb box-border"
>
	{@render children()}
</div>
