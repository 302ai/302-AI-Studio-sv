<script lang="ts">
	import { AccordionItem, AccordionTrigger } from "$lib/components/ui/accordion";
	import AccordionContent from "$lib/components/ui/accordion/accordion-content.svelte";
	import Accordion from "$lib/components/ui/accordion/accordion.svelte";
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
	import { openclawConfigState } from "$lib/stores/code-agent/openclaw/openclaw-config-state.svelte";
	import { RefreshCw } from "@lucide/svelte";
	import SettingInputField from "../settings/setting-input-field.svelte";
	import ConfirmDialog from "./confirm-dialog.svelte";

	let confirmDialogOpen = $state(false);
	let applyConfigLoading = $state(false);

	let updateBtnDiabled = $derived(!openclawConfigState.currentOcAgentId);

	async function handleConfirmDialogOk() {
		applyConfigLoading = true;
		try {
			await window.electronAPI.openClawService.applyOpenClawChannelConfig();
			if (localEnvState.openClawHealthStatus !== "unknown") {
				await window.electronAPI.localVibeService.restartPodmanMachine();
			}
			await openclawConfigState.updateBindings();
		} catch (e) {
			console.warn(e);
		} finally {
			confirmDialogOpen = false;
			applyConfigLoading = false;
		}
	}

	const bind = <T,>(get: () => T, set: (v: T) => void) => ({
		get value() {
			return get();
		},
		set value(v: T) {
			set(v);
		},
	});

	const feishuSessionId = bind(
		() => openclawConfigState.feishuSessionId,
		openclawConfigState.updateFeishuSessionId.bind(openclawConfigState),
	);

	async function handleNewSettingsTab(route: string) {
		await window.electronAPI.windowService.handleOpenSettingsWindow(route);
	}
</script>

{#snippet feishu()}
	<Accordion type="single" class="w-full rounded-settings-item">
		<AccordionItem value="fei-shu" class="border-b-0">
			<AccordionTrigger class="py-3.5 px-4 bg-input hover:no-underline">
				<Label class="font-normal no-underline cursor-pointer">{m.open_claw_channel_feishu()}</Label
				>
			</AccordionTrigger>
			<AccordionContent class="pb-0 pt-2 space-y-2">
				<div class="rounded-lg border p-4 space-y-4">
					<SettingInputField
						label={`${m.open_claw_channel_session_id_optional()}`}
						placeholder={m.placeholder_input_session_id()}
						class="[&>label]:text-label-fg"
						bind:value={feishuSessionId.value}
					/>
					<div class="flex items-center justify-between text-muted-foreground text-xs">
						<button
							onclick={() =>
								window.electronAPI.externalLinkService.openExternalLink(
									"https://open.feishu.cn/app",
								)}
							class="text-primary hover:underline cursor-pointer"
							>{m.open_claw_channel_config_feishu()}</button
						>
						<button
							onclick={() => handleNewSettingsTab("/settings/agent-settings?platform=local")}
							class="text-primary hover:underline cursor-pointer"
							>{m.open_claw_channel_view_more_settings()}</button
						>
					</div>
				</div>
			</AccordionContent>
		</AccordionItem>
	</Accordion>
{/snippet}

{#snippet telegram()}
	<Accordion type="single" class="w-full hidden rounded-settings-item">
		<AccordionItem value="fei-shu" class="border-b-0">
			<AccordionTrigger class="py-3.5 px-4 bg-input hover:no-underline">
				<Label class=" font-normal no-underline cursor-pointer"
					>{m.open_claw_channel_telegram()}</Label
				>
			</AccordionTrigger>
			<AccordionContent class="pb-0 pt-2 space-y-2">
				<div class="rounded-lg border p-4 space-y-4">
					<SettingInputField
						label={`${m.open_claw_channel_session_id()}`}
						placeholder={m.placeholder_input_session_id()}
						class="[&>label]:text-label-fg"
					/>
					<div class="flex items-center justify-between text-muted-foreground text-xs">
						<button
							onclick={() => handleNewSettingsTab("/settings/agent-settings/local")}
							class="text-primary hover:underline cursor-pointer"
							>{m.open_claw_channel_config_telegram()}</button
						>
						<button
							onclick={() => handleNewSettingsTab("/settings/agent-settings?platform=local")}
							class="text-primary hover:underline cursor-pointer"
							>{m.open_claw_channel_view_more_settings()}</button
						>
					</div>
				</div>
			</AccordionContent>
		</AccordionItem>
	</Accordion>
{/snippet}

<Accordion type="single" value="channel-settings" class="w-full m-0 ">
	<AccordionItem value="channel-settings" class="border-b-0">
		<AccordionTrigger class="py-2 hover:no-underline">
			<Label class="text-label-fg cursor-pointer">{m.agent_framework_open_claw_set_channel()}</Label
			>
		</AccordionTrigger>
		<AccordionContent class="pb-1 pt-0 space-y-2">
			{@render feishu()}
			{@render telegram()}
			<div class="flex flex-col items-end">
				<Button
					disabled={updateBtnDiabled}
					class="w-fit"
					onclick={() => (confirmDialogOpen = true)}
				>
					<RefreshCw class="size-4" />
					{m.open_claw_update_config()}
				</Button>
				{#if updateBtnDiabled}
					<p class="text-xs text-muted-foreground mt-1">
						{m.open_claw_update_config_hint()}
					</p>
				{/if}
			</div>
		</AccordionContent>
	</AccordionItem>
</Accordion>

<ConfirmDialog bind:confirmDialogOpen bind:applyConfigLoading {handleConfirmDialogOk} />
