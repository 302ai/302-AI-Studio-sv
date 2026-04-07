<script lang="ts">
	import { m } from "$lib/paraglide/messages.js";
	import { Label } from "$lib/components/ui/label/index.js";
</script>

<div class="flex flex-col gap-settings-gap">
	<Label class="text-label-fg font-normal">{m.settings_subscriptions()}</Label>
	<div
		class="rounded-settings-item bg-settings-item-bg px-settings-item-x py-settings-item-y flex flex-col w-full items-start gap-2"
	>
		<Label class="text-[16px] font-semibold">{m.settings_subscription_cloud_openclaw()}</Label>
		<div class="flex items-center flex-col gap-2 mt-2 text-sm">
			<p>
				<span class="text-muted-foreground"
					>{m.settings_subscription_effective_date()}:</span
				> 2026-04-01
			</p>
			<p>
				<span class="text-muted-foreground">{m.settings_subscription_expiry_date()}:</span> 2026-05-01
			</p>
		</div>
	</div>
</div>
