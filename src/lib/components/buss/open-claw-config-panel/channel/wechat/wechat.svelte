<script lang="ts">
	import {
		AccordionContent,
		AccordionItem,
		AccordionTrigger,
	} from "$lib/components/ui/accordion";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import ChannelQrLoginPanel from "./channel-qr-login-panel.svelte";
	import { cloudChannelService } from "./cloud-channel-service.svelte";
	import { localChannelService } from "./local-channel-service.svelte";
</script>

<AccordionItem id="wechat" value="wechat" class="border-b-0 my-1">
	<AccordionTrigger class="py-3.5 px-4 bg-input hover:no-underline">
		<Label class="font-normal no-underline cursor-pointer">{m.open_claw_channel_wechat()}</Label
		>
	</AccordionTrigger>
	<AccordionContent class="pb-0 pt-2 space-y-2">
		<ChannelQrLoginPanel
			label={m.open_claw_wechat_scan_qrcode_hint() + "-本地"}
			service={localChannelService}
		/>
		<ChannelQrLoginPanel
			label={m.open_claw_wechat_scan_qrcode_hint() + "-云主机"}
			service={cloudChannelService}
		/>
	</AccordionContent>
</AccordionItem>
