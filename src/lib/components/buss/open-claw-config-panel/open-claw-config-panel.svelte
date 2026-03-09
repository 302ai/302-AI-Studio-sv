<script lang="ts">
	import { AccordionContent, AccordionItem, AccordionTrigger } from "$lib/components/ui/accordion";
	import Accordion from "$lib/components/ui/accordion/accordion.svelte";
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/field";
	import { m } from "$lib/paraglide/messages";
	import { codeAgentGlobalConfigsState } from "$lib/stores/code-agent";
	import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
	import { Loader2, RefreshCw } from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import SettingInputField from "../settings/setting-input-field.svelte";

	let confirmDialogOpen = $state(false);
	let applyConfigLoading = $state(false);

	// 使用 Getter/Setter 代理模式处理 feishu 配置的绑定，解决派生状态只读及判空问题
	const feishuAppId = {
		get value() {
			return codeAgentGlobalConfigsState.feishu.appId;
		},
		set value(v: string) {
			codeAgentGlobalConfigsState.updateFeishuAppId(v);
		},
	};

	const feishuAppSecret = {
		get value() {
			return codeAgentGlobalConfigsState.feishu.appSecret;
		},
		set value(v: string) {
			codeAgentGlobalConfigsState.updateFeishuAppSecret(v);
		},
	};

	async function handleConfirmDialogOk() {
		applyConfigLoading = true;
		try {
			await window.electronAPI.openClawService.applyOpenClawChannelConfig();
			await window.electronAPI.localVibeService.restartPodmanMachine();
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

<Accordion type="single" value="channel-settings" class="w-full m-0">
	<AccordionItem value="channel-settings" class="border-b-0">
		<AccordionTrigger class="py-2 hover:no-underline">
			<Label class="text-label-fg font-normal no-underline hover:underline cursor-pointer"
				>{m.agent_framework_open_claw_set_channel()}</Label
			>
		</AccordionTrigger>
		<AccordionContent class="pb-1 pt-0 space-y-2">
			<Accordion type="single" value="fei-shu" class="w-full rounded-settings-item">
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
									<a
										href="https://open.feishu.cn/app?lang=zh-CN"
										class="text-primary hover:underline">{m.open_claw_feishu_get_id_and_secret()}</a
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
			<div class="flex flex-col items-end">
				<Button class="w-24" onclick={() => (confirmDialogOpen = true)}>
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
					<Loader2 class="h-4 w-4 animate-spin" />
				{/if}
				{m.open_claw_update()}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
