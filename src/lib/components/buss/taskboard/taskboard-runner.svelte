<script lang="ts">
	import Button from "$lib/components/ui/button/button.svelte";
	import * as m from "$lib/paraglide/messages";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { codeAgentSendMessageButtonState, codeAgentState } from "$lib/stores/code-agent";
	import { codeAgentTaskboardState } from "$lib/stores/code-agent/code-agent-taskboard-state.svelte";
	import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
	import { persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { cn } from "$lib/utils.js";
	import { toast } from "svelte-sonner";
	import { match } from "ts-pattern";

	let openModelSelect = $state<() => void>();

	// Derived states from store
	const isRunning = $derived(codeAgentTaskboardState.taskboardStatus === "running");
	const isWaitingToStop = $derived(codeAgentTaskboardState.taskboardStatus === "waiting_to_stop");
	const isWaitingForChat = $derived(
		codeAgentTaskboardState.taskboardStatus === "waiting_for_chat",
	);
	const currentTask = $derived(
		codeAgentTaskboardState.tasklist.find((t) => t.status === "in_progress"),
	);
	const taskContent = $derived(codeAgentTaskboardState.activeTask?.content ?? "—");
	const buttonText = $derived(codeAgentTaskboardState.buttonText);

	// Check if local sandbox is starting (for disabling run button)
	const isLocalSandboxStarting = $derived(
		codeAgentState.type === "local" && localEnvState.sandboxStarting,
	);

	const hasConfiguredProviders = $derived(() => {
		return persistedProviderState.current.some(
			(provider) => provider.enabled && provider.apiKey && provider.apiKey.trim() !== "",
		);
	});

	async function handleGoToModelSettings() {
		await window.electronAPI.windowService.handleOpenSettingsWindow("/settings/model-settings");
	}

	const runTask = async (content: string) => {
		let didSend = false;

		const trySend = (taskContent: string) =>
			match({
				isEmpty: taskContent.trim() === "" && chatState.attachments.length === 0,
				noProviders: !hasConfiguredProviders(),
				noModel: chatState.selectedModel === null,
				isBusy: chatState.isStreaming || chatState.isSubmitted,
				hasLoadingAttachments: chatState.loadingAttachmentIds.size > 0,
			})
				.with({ isEmpty: true }, () => {
					toast.warning(m.toast_empty_message());
					return false;
				})
				.with({ noProviders: true }, () => {
					toast.info(m.toast_no_provider_configured(), {
						action: {
							label: m.text_button_go_to_settings(),
							onClick: () => handleGoToModelSettings(),
						},
					});
					return false;
				})
				.with({ noModel: true }, () => {
					toast.warning(m.toast_no_model(), {
						action: {
							label: m.text_button_select_model(),
							onClick: () => {
								if (!hasConfiguredProviders()) {
									toast.info(m.toast_no_provider_configured(), {
										action: {
											label: m.text_button_go_to_settings(),
											onClick: () => handleGoToModelSettings(),
										},
									});
									return;
								}
								openModelSelect?.();
							},
						},
					});
					return false;
				})
				.with({ isBusy: true }, () => false)
				.with({ hasLoadingAttachments: true }, () => false)
				.otherwise(() => {
					didSend = true;
					if (chatState.hasMessages) {
						chatState.sendMessage({ content: taskContent });
					} else {
						document.startViewTransition(() =>
							chatState.sendMessage({ content: taskContent }),
						);
					}
					return true;
				});

		if (codeAgentState.enabled && codeAgentState.isFreshTab) {
			await codeAgentSendMessageButtonState.handleCodeAgentFlow(() => {
				trySend(content);
			});
			return didSend;
		}
		if (codeAgentState.enabled && codeAgentState.type === "local") {
			// For local mode in non-fresh tabs, only ensure sandbox is running
			const localSandboxResult =
				await codeAgentSendMessageButtonState.ensureLocalSandboxReady();
			if (!localSandboxResult.isOk) {
				toast.error(localSandboxResult.error ?? m.code_agent_local_sandbox_start_failed());
				return false;
			}
			return trySend(content);
		}
		return trySend(content);
	};

	codeAgentTaskboardState.registerExecutionHandler(runTask);

	async function handleRun() {
		if (codeAgentState.inPlanMode) {
			toast.info(m.toast_exit_plan_mode_first());
			return;
		}

		await codeAgentTaskboardState.startAutoExecution(runTask);
	}
</script>

<div class="p-3">
	<div class={cn("flex flex-col gap-2 p-3 rounded-xl border", "bg-input")}>
		<!-- Row 1: Status indicators & buttons (wrap on narrow) -->
		<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
			<!-- Status indicator -->
			<div class="flex items-center gap-2 text-sm">
				{#if isWaitingForChat}
					<span class="flex items-center gap-1.5 text-blue-500">
						<span class="size-2 rounded-full bg-blue-500 animate-pulse"></span>
						{m.taskboard_status_waiting_for_chat()}
					</span>
				{:else if isWaitingToStop}
					<span class="flex items-center gap-1.5 text-yellow-500">
						<span class="size-2 rounded-full bg-yellow-500 animate-pulse"></span>
						{m.taskboard_status_waiting_to_stop()}
					</span>
				{:else if isRunning}
					<span class="flex items-center gap-1.5 text-primary">
						<span class="size-2 rounded-full bg-primary animate-pulse"></span>
						{m.taskboard_status_running()}
					</span>
				{:else}
					<span class="flex items-center gap-1.5 text-muted-foreground">
						<span class="size-2 rounded-full bg-muted-foreground/50"></span>
						{m.taskboard_status_idle()}
					</span>
				{/if}
			</div>

			<!-- Buttons -->
		</div>

		<!-- Row 2: Current task -->
		<div class="flex justify-between">
			<div class="flex items-center gap-2 text-sm min-w-0">
				<span class="text-muted-foreground shrink-0">{m.taskboard_label_current()}</span>
				<span class="truncate font-medium">{taskContent}</span>
			</div>
			<div class="flex items-center gap-2">
				<Button
					variant="default"
					size="sm"
					disabled={(!codeAgentTaskboardState.canStart &&
						!isRunning &&
						!isWaitingToStop &&
						!isWaitingForChat &&
						!currentTask) ||
						(!isRunning &&
							!isWaitingToStop &&
							!isWaitingForChat &&
							(codeAgentState.isChecking || isLocalSandboxStarting))}
					onclick={handleRun}
				>
					{buttonText}
				</Button>
			</div>
		</div>
	</div>
</div>
