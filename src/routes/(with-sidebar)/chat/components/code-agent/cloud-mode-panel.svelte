<script lang="ts" module>
	export interface Props {
		onClose?: () => void;
	}
</script>

<script lang="ts">
	import CloudRuningCard from "$lib/components/buss/local-agent-panel/cloud-runing-card.svelte";

	import { Button } from "$lib/components/ui/button";
	import { m } from "$lib/paraglide/messages";

	let { onClose }: Props = $props();

	function handleLocalModeConfirm() {
		onClose?.();
	}
</script>

<div class="gap-settings-gap flex flex-col">
	<!-- Section 1: Environment Monitoring -->
	<section class="space-y-4">
		<!-- Environment Cards Container -->
		<div class="rounded-lg border p-4 space-y-4">
			<CloudRuningCard />
		</div>
	</section>

	<!-- Footer with Cancel/Confirm buttons -->
	<div class="flex flex-row justify-between">
		<Button variant="secondary" onclick={onClose}>
			{m.common_cancel()}
		</Button>
		<Button onclick={handleLocalModeConfirm}>
			{m.label_button_confirm()}
		</Button>
	</div>
</div>
