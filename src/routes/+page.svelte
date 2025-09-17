<script lang="ts">
	import Button from "$lib/components/ui/button/button.svelte";
	import { ThemeSwitcher } from "$lib/components/buss/theme-switcher";
</script>

<div class="container mx-auto p-8">
	<h1 class="mb-4 text-4xl font-bold">Welcome to AI Studio</h1>
	<p class="text-muted-foreground mb-8 text-lg">
		Choose a layout from the tabs above to see different layout options
	</p>

	<div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
		<div class="rounded-lg border p-6">
			<h2 class="mb-3 text-2xl font-semibold">With Sidebar Layout</h2>
			<p class="text-muted-foreground mb-4">
				Navigate to the Dashboard tab to see a layout with a collapsible sidebar
			</p>
			<Button onclick={() => (window.location.href = "/dashboard")}>Go to Dashboard</Button>
		</div>

		<div class="rounded-lg border p-6">
			<h2 class="mb-3 text-2xl font-semibold">Full Width Layout</h2>
			<p class="text-muted-foreground mb-4">
				Navigate to the Full Width tab to see a layout without sidebar
			</p>
			<Button onclick={() => (window.location.href = "/full")}>Go to Full Width</Button>
		</div>
	</div>
</div>
