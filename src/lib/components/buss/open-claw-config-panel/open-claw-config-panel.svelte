<script lang="ts" module>
	interface Props {
		className?: string;
	}
</script>

<script lang="ts">
	import { AccordionContent, AccordionItem, AccordionTrigger } from "$lib/components/ui/accordion";
	import Accordion from "$lib/components/ui/accordion/accordion.svelte";
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/field";
	import { m } from "$lib/paraglide/messages";
	import { codeAgentGlobalConfigsState } from "$lib/stores/code-agent";
	import { RefreshCw } from "@lucide/svelte";
	import SettingInputField from "../settings/setting-input-field.svelte";
	import Wechat from "./channel/wechat.svelte";
	import ConfirmDialog from "./confirm-dialog.svelte";
	import { ApplyOpenClawChannelConfigConfirm } from "./hooks";

	const { className }: Props = $props();

	let confirmDialogOpen = $state(false);
	let applyConfigLoading = $state(false);

	let localFeishu = $state({
		appId: codeAgentGlobalConfigsState.feishu.appId,
		appSecret: codeAgentGlobalConfigsState.feishu.appSecret,
	});
	let localDingtalk = $state({
		clientId: codeAgentGlobalConfigsState.dingtalk.clientId,
		clientSecret: codeAgentGlobalConfigsState.dingtalk.clientSecret,
	});
	let localQqbot = $state({
		appId: codeAgentGlobalConfigsState.qqbot.appId,
		clientSecret: codeAgentGlobalConfigsState.qqbot.clientSecret,
	});
	let localWecom = $state({
		botId: codeAgentGlobalConfigsState.wecom.botId,
		secret: codeAgentGlobalConfigsState.wecom.secret,
	});
	let localTelegram = $state({
		botToken: codeAgentGlobalConfigsState.telegram.accounts.default.botToken,
	});

	let { handleConfirmDialogOk } = ApplyOpenClawChannelConfigConfirm({
		prepareAction: async () => {
			await codeAgentGlobalConfigsState
				.batchUpdater()
				.update("feishu", localFeishu)
				.update("dingtalk", localDingtalk)
				.update("qqbot", localQqbot)
				.update("wecom", localWecom)
				.update("telegram", {
					accounts: {
						default: { botToken: localTelegram.botToken },
					},
				})
				.apply();
			await window.electronAPI.openClawService.applyOpenClawChannelConfig();
		},
		open: (v) => (confirmDialogOpen = v),
		loading: (v) => (applyConfigLoading = v),
	});
</script>

{#snippet feishu()}
	<Accordion type="single" class="w-full rounded-settings-item">
		<AccordionItem value="fei-shu" class="border-b-0">
			<AccordionTrigger id="feishu" class="py-3.5 px-4 bg-input hover:no-underline">
				<Label class=" font-normal no-underline cursor-pointer"
					>{m.open_claw_channel_feishu()}</Label
				>
			</AccordionTrigger>
			<AccordionContent class="pb-0 pt-2 space-y-2">
				<div class="rounded-lg border p-4 space-y-4">
					<!-- <div>
								<span class={cn("size-2 rounded-full", statusColorClass)}></span>
								</div> -->
					<!-- bind:value={tempAppid} -->
					<SettingInputField
						label={m.open_claw_appid()}
						placeholder={m.open_claw_placeholder_appid()}
						bind:value={localFeishu.appId}
						class="[&>label]:text-label-fg"
					/>
					<!-- bind:value={tempAppSecret} -->
					<SettingInputField
						label={m.open_claw_app_secret()}
						placeholder={m.open_claw_placeholder_app_secret()}
						type="password"
						bind:value={localFeishu.appSecret}
						class="[&>label]:text-label-fg"
					/>
					<div class="flex items-center justify-between">
						<div class=" text-muted-foreground flex items-center gap-2 text-xs">
							<a href="https://open.feishu.cn/app?lang=zh-CN" class="text-primary hover:underline">
								{m.open_claw_feishu_get_id_and_secret()}</a
							>
							<div class="text-muted-foreground/50">|</div>
							<a
								href="https://studio.302.ai/zh/docs/advanced/open-claw/feishu"
								class="text-primary hover:underline"
								>{m.open_claw_feishu_view_deployment_tutorial()}</a
							>
						</div>
					</div>
				</div>
			</AccordionContent>
		</AccordionItem>
	</Accordion>
{/snippet}

{#snippet dingtalk()}
	<Accordion type="single" class="w-full rounded-settings-item">
		<AccordionItem value="dingtalk" class="border-b-0">
			<AccordionTrigger class="py-3.5 px-4 bg-input hover:no-underline">
				<Label class=" font-normal no-underline cursor-pointer"
					>{m.open_claw_channel_dingtalk()}</Label
				>
			</AccordionTrigger>
			<AccordionContent class="pb-0 pt-2 space-y-2">
				<div class="rounded-lg border p-4 space-y-4">
					<SettingInputField
						label={m.open_claw_dingtalk_client_id()}
						placeholder={m.open_claw_dingtalk_placeholder_client_id()}
						bind:value={localDingtalk.clientId}
						class="[&>label]:text-label-fg"
					/>
					<!-- bind:value={tempAppSecret} -->
					<SettingInputField
						label={m.open_claw_dingtalk_client_secret()}
						placeholder={m.open_claw_dingtalk_placeholder_client_secret()}
						type="password"
						bind:value={localDingtalk.clientSecret}
						class="[&>label]:text-label-fg"
					/>
					<div class="flex items-center justify-between">
						<div class=" text-muted-foreground flex items-center gap-2 text-xs">
							<a href="https://open-dev.dingtalk.com/" class="text-primary hover:underline"
								>{m.open_claw_feishu_get_id_and_secret()}</a
							>
							<div class="text-muted-foreground/50">|</div>
							<a
								href="https://studio.302.ai/zh/docs/advanced/open-claw/dingtalk"
								class="text-primary hover:underline"
								>{m.open_claw_feishu_view_deployment_tutorial()}</a
							>
						</div>
					</div>
				</div>
			</AccordionContent>
		</AccordionItem>
	</Accordion>
{/snippet}

{#snippet qqbot()}
	<Accordion type="single" class="w-full rounded-settings-item">
		<AccordionItem value="qqbot" class="border-b-0">
			<AccordionTrigger class="py-3.5 px-4 bg-input hover:no-underline">
				<Label class=" font-normal no-underline cursor-pointer">{m.open_claw_channel_qqbot()}</Label
				>
			</AccordionTrigger>
			<AccordionContent class="pb-0 pt-2 space-y-2">
				<div class="rounded-lg border p-4 space-y-4">
					<SettingInputField
						label={m.open_claw_qqbot_app_id()}
						placeholder={m.open_claw_qqbot_placeholder_app_id()}
						bind:value={localQqbot.appId}
						class="[&>label]:text-label-fg"
					/>
					<!-- bind:value={tempAppSecret} -->
					<SettingInputField
						label={m.open_claw_qqbot_app_secret()}
						placeholder={m.open_claw_qqbot_placeholder_app_secret()}
						type="password"
						bind:value={localQqbot.clientSecret}
						class="[&>label]:text-label-fg"
					/>
					<div class="flex items-center justify-between">
						<div class=" text-muted-foreground flex items-center gap-2 text-xs">
							<a href="https://q.qq.com/#/" class="text-primary hover:underline"
								>{m.open_claw_feishu_get_id_and_secret()}</a
							>
							<div class="text-muted-foreground/50">|</div>
							<a
								href="https://studio.302.ai/zh/docs/advanced/open-claw/qqbot"
								class="text-primary hover:underline"
								>{m.open_claw_feishu_view_deployment_tutorial()}</a
							>
						</div>
					</div>
				</div>
			</AccordionContent>
		</AccordionItem>
	</Accordion>
{/snippet}

{#snippet wecom()}
	<Accordion type="single" class="w-full rounded-settings-item">
		<AccordionItem value="wecom" class="border-b-0">
			<AccordionTrigger class="py-3.5 px-4 bg-input hover:no-underline">
				<Label class=" font-normal no-underline cursor-pointer">{m.open_claw_channel_wecom()}</Label
				>
			</AccordionTrigger>
			<AccordionContent class="pb-0 pt-2 space-y-2">
				<div class="rounded-lg border p-4 space-y-4">
					<SettingInputField
						label={m.open_claw_wecom_bot_id()}
						placeholder={m.open_claw_wecom_placeholder_bot_id()}
						bind:value={localWecom.botId}
						class="[&>label]:text-label-fg"
					/>
					<!-- bind:value={tempAppSecret} -->
					<SettingInputField
						label={m.open_claw_wecom_secret()}
						placeholder={m.open_claw_wecom_placeholder_secret()}
						type="password"
						bind:value={localWecom.secret}
						class="[&>label]:text-label-fg"
					/>
					<div class="flex items-center justify-between">
						<div class=" text-muted-foreground flex items-center gap-2 text-xs">
							<a href="https://work.weixin.qq.com/" class="text-primary hover:underline"
								>{m.open_claw_feishu_get_id_and_secret()}</a
							>
							<div class="text-muted-foreground/50">|</div>
							<a
								href="https://studio.302.ai/zh/docs/advanced/open-claw/wecom"
								class="text-primary hover:underline"
								>{m.open_claw_feishu_view_deployment_tutorial()}</a
							>
						</div>
					</div>
				</div>
			</AccordionContent>
		</AccordionItem>
	</Accordion>
{/snippet}

{#snippet telegram()}
	<Accordion type="single" class="w-full rounded-settings-item">
		<AccordionItem value="telegram" class="border-b-0">
			<AccordionTrigger class="py-3.5 px-4 bg-input hover:no-underline">
				<Label class=" font-normal no-underline cursor-pointer"
					>{m.open_claw_channel_telegram()}</Label
				>
			</AccordionTrigger>
			<AccordionContent class="pb-0 pt-2 space-y-2">
				<div class="rounded-lg border p-4 space-y-4">
					<SettingInputField
						label={m.open_claw_telegram_bot_token()}
						placeholder={m.open_claw_telegram_placeholder_bot_token()}
						bind:value={localTelegram.botToken}
						class="[&>label]:text-label-fg"
					/>
					<div class="flex items-center justify-between">
						<div class=" text-muted-foreground flex items-center gap-2 text-xs">
							<a href="https://t.me/BotFather" class="text-primary hover:underline"
								>{m.open_claw_telegram_get_bot_token()}</a
							>
							<div class="text-muted-foreground/50">|</div>
							<a
								href="https://studio.302.ai/zh/docs/advanced/open-claw/telegram"
								class="text-primary hover:underline"
								>{m.open_claw_feishu_view_deployment_tutorial()}</a
							>
						</div>
					</div>
				</div>
			</AccordionContent>
		</AccordionItem>
	</Accordion>
{/snippet}

<Accordion type="single" value="channel-settings" class="w-full m-0 {className}">
	<AccordionItem value="channel-settings" class="border-b-0">
		<AccordionTrigger class="py-2 hover:no-underline">
			<Label class="text-label-fg cursor-pointer">{m.agent_framework_open_claw_set_channel()}</Label
			>
		</AccordionTrigger>
		<AccordionContent class="pb-1 pt-0 space-y-2">
			{@render feishu()}
			{@render dingtalk()}
			{@render qqbot()}
			{@render wecom()}
			<Wechat />
			{@render telegram()}
			<div class="flex flex-col items-end">
				<Button class="w-fit" onclick={() => (confirmDialogOpen = true)}>
					<RefreshCw class="size-4" />
					{m.open_claw_update_config()}
				</Button>
			</div>
		</AccordionContent>
	</AccordionItem>
</Accordion>

<ConfirmDialog bind:confirmDialogOpen bind:applyConfigLoading {handleConfirmDialogOk} />
