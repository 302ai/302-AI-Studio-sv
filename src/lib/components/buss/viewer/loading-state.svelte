<script lang="ts" module>
	export interface LoadingStateProps {
		message?: string;
	}
</script>

<script lang="ts">
	let { message = "Loading content..." }: LoadingStateProps = $props();
</script>

<div class="flex h-full items-center justify-center">
	<div class="text-center">
		<div class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
		<p class="text-sm text-muted-foreground">{message}</p>
	</div>
</div>
