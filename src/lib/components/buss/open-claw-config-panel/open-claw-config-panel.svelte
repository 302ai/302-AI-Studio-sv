<script lang="ts" module>
	interface Props {
		className?: string;
	}
</script>

<script lang="ts">
	import { AccordionContent, AccordionItem, AccordionTrigger } from "$lib/components/ui/accordion";
	import Accordion from "$lib/components/ui/accordion/accordion.svelte";
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/field";
	import { m } from "$lib/paraglide/messages";
	import { codeAgentGlobalConfigsState } from "$lib/stores/code-agent";
	import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
	import { LoaderCircle, RefreshCw } from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import SettingInputField from "../settings/setting-input-field.svelte";
	import { isWindows } from "$lib/utils/platform";

	let confirmDialogOpen = $state(false);
	let applyConfigLoading = $state(false);

	const { className }: Props = $props();

	const bind = <T,>(get: () => T, set: (v: T) => void) => ({
		get value() {
			return get();
		},
		set value(v: T) {
			set(v);
		},
	});

	const feishuAppId = bind(
		() => codeAgentGlobalConfigsState.feishu.appId,
		codeAgentGlobalConfigsState.updateFeishuAppId,
	);

	const feishuAppSecret = bind(
		() => codeAgentGlobalConfigsState.feishu.appSecret,
		codeAgentGlobalConfigsState.updateFeishuAppSecret,
	);

	const dingtalkClientId = {
		get value() {
			return codeAgentGlobalConfigsState.dingtalk.clientId;
		},
		set value(v: string) {
			codeAgentGlobalConfigsState.updateDingtalkClientId(v);
		},
	};

	const dingtalkClientSecret = {
		get value() {
			return codeAgentGlobalConfigsState.dingtalk.clientSecret;
		},
		set value(v: string) {
			codeAgentGlobalConfigsState.updateDingtalkClientSecret(v);
		},
	};

	const qqbotAppId = {
		get value() {
			return codeAgentGlobalConfigsState.qqbot.appId;
		},
		set value(v: string) {
			codeAgentGlobalConfigsState.updateQqbotAppId(v);
		},
	};

	const qqbotClientSecret = {
		get value() {
			return codeAgentGlobalConfigsState.qqbot.clientSecret;
		},
		set value(v: string) {
			codeAgentGlobalConfigsState.updateQqbotClientSecret(v);
		},
	};

	const wecomBotId = {
		get value() {
			return codeAgentGlobalConfigsState.wecom.botId;
		},
		set value(v: string) {
			codeAgentGlobalConfigsState.updateWecomBotId(v);
		},
	};

	const wecomSecret = {
		get value() {
			return codeAgentGlobalConfigsState.wecom.secret;
		},
		set value(v: string) {
			codeAgentGlobalConfigsState.updateWecomSecret(v);
		},
	};

	const telegramBotToken = {
		get value() {
			return codeAgentGlobalConfigsState.telegram.botToken;
		},
		set value(v: string) {
			codeAgentGlobalConfigsState.updateTelegramBotToken(v);
		},
	};

	const telegramAllowFrom = {
		get value() {
			return codeAgentGlobalConfigsState.telegram.allowFrom.join(",");
		},
		set value(v: string) {
			codeAgentGlobalConfigsState.updateTelegramAllowFrom(v.split(","));
		},
	};

	async function handleConfirmDialogOk() {
		applyConfigLoading = true;
		try {
			await window.electronAPI.openClawService.applyOpenClawChannelConfig();
			if (localEnvState.openClawHealthStatus !== "unknown") {
				await window.electronAPI.localVibeService.restartPodmanMachine();
			}
		} catch (e) {
			const error = e as NodeJS.ErrnoException;
			if (error.code === "ENOENT") {
				const toastId = "local-code-agent-connection-error";
				const isAlreadyVisible = toast.getActiveToasts().some((t) => t.id === toastId);

				if (!localEnvState.sandboxStarting && !isAlreadyVisible) {
					toast.error(m.code_agent_local_container_not_started(), {
						id: toastId,
						action: {
							label: m.toast_button_start_sandbox(),
							onClick: async () => {
								await localEnvState.startSandbox();
							},
						},
					});
				}
			}
			console.warn(e);
		} finally {
			confirmDialogOpen = false;
			applyConfigLoading = false;
		}
	}
</script>

{#snippet feishu()}
	<Accordion type="single" class="w-full rounded-settings-item">
		<AccordionItem value="fei-shu" class="border-b-0">
			<AccordionTrigger class="py-3.5 px-4 bg-input hover:no-underline">
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
						bind:value={feishuAppId.value}
						class="[&>label]:text-label-fg"
					/>
					<!-- bind:value={tempAppSecret} -->
					<SettingInputField
						label={m.open_claw_app_secret()}
						placeholder={m.open_claw_placeholder_app_secret()}
						type="password"
						bind:value={feishuAppSecret.value}
						class="[&>label]:text-label-fg"
					/>
					<div class="flex items-center justify-between">
						<div class=" text-muted-foreground flex items-center gap-2 text-xs">
							<a href="https://open.feishu.cn/app?lang=zh-CN" class="text-primary hover:underline"
								>{m.open_claw_feishu_get_id_and_secret()}</a
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
						bind:value={dingtalkClientId.value}
						class="[&>label]:text-label-fg"
					/>
					<!-- bind:value={tempAppSecret} -->
					<SettingInputField
						label={m.open_claw_dingtalk_client_secret()}
						placeholder={m.open_claw_dingtalk_placeholder_client_secret()}
						type="password"
						bind:value={dingtalkClientSecret.value}
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
						bind:value={qqbotAppId.value}
						class="[&>label]:text-label-fg"
					/>
					<!-- bind:value={tempAppSecret} -->
					<SettingInputField
						label={m.open_claw_qqbot_app_secret()}
						placeholder={m.open_claw_qqbot_placeholder_app_secret()}
						type="password"
						bind:value={qqbotClientSecret.value}
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
						bind:value={wecomBotId.value}
						class="[&>label]:text-label-fg"
					/>
					<!-- bind:value={tempAppSecret} -->
					<SettingInputField
						label={m.open_claw_wecom_secret()}
						placeholder={m.open_claw_wecom_placeholder_secret()}
						type="password"
						bind:value={wecomSecret.value}
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
				<Label class=" font-normal no-underline cursor-pointer">Telegram</Label>
			</AccordionTrigger>
			<AccordionContent class="pb-0 pt-2 space-y-2">
				<div class="rounded-lg border p-4 space-y-4">
					<SettingInputField
						label="Bot Token"
						placeholder="请输入Bot Token"
						bind:value={telegramBotToken.value}
						class="[&>label]:text-label-fg"
					/>
					<!-- bind:value={tempAppSecret} -->
					<!-- TONE: Allow From is disable -->
					<SettingInputField
						label="Allow From"
						placeholder="请输入allowFrom,使用','分割"
						type="password"
						bind:value={telegramAllowFrom.value}
						class="[&>label]:text-label-fg hidden"
					/>
					<div class="flex items-center justify-between">
						<div class=" text-muted-foreground flex items-center gap-2 text-xs">
							<a href="https://t.me/BotFather" class="text-primary hover:underline"
								>{m.open_claw_feishu_get_id_and_secret()}</a
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
			<!-- NOTE: windows hidden channel -->
			{#if !isWindows}
				{@render dingtalk()}
				{@render qqbot()}
				{@render wecom()}
			{/if}
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

<AlertDialog.Root bind:open={confirmDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{m.open_claw_update_config()}</AlertDialog.Title>
			<AlertDialog.Description>
				{m.open_claw_update_config_dialog_description()}
			</AlertDialog.Description>
		</AlertDialog.Header>

		<AlertDialog.Footer>
			<AlertDialog.Cancel>{m.common_cancel()}</AlertDialog.Cancel>
			<AlertDialog.Action onclick={handleConfirmDialogOk} disabled={applyConfigLoading}>
				{#if applyConfigLoading}
					<LoaderCircle class="h-4 w-4 animate-spin" />
				{/if}
				{m.open_claw_update()}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
