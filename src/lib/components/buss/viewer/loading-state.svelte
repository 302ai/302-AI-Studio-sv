<script lang="ts" module>
	export interface LoadingStateProps {
		message?: string;
	}
</script>

<script lang="ts">
	const { message = "Loading content..." }: LoadingStateProps = $props();
</script>

<div class="flex h-full items-center justify-center">
	<div class="text-center">
		<div class="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
		<p class="text-muted-foreground text-sm">{message}</p>
	</div>
</div>
