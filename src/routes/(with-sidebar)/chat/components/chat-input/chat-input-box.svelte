<script lang="ts">
	import sendMessageIcon from "$lib/assets/send-message.svg";
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader";
	import { ModelSelect } from "$lib/components/buss/model-select";
	import { QuickPromptPanel } from "$lib/components/buss/quick-prompt";
	import { Button } from "$lib/components/ui/button";
	import * as Popover from "$lib/components/ui/popover";
	import { Separator } from "$lib/components/ui/separator";
	import { Textarea } from "$lib/components/ui/textarea";
	import type { QuickPrompt } from "$lib/datas/quick-prompts";
	import { m } from "$lib/paraglide/messages.js";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { codeAgentSendMessageButtonState } from "$lib/stores/code-agent/code-agent-send-message-button-state.svelte";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import { codeAgentTaskboardState } from "$lib/stores/code-agent/code-agent-taskboard-state.svelte";
	import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
	import { fileToBase64 } from "$lib/stores/code-agent/utils";
	import { modelPanelState } from "$lib/stores/model-panel-state.svelte";
	import { persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { quickPromptState } from "$lib/stores/quick-prompt-state.svelte";
	import { shortcutSettings } from "$lib/stores/shortcut-settings.state.svelte";
	import { cn } from "$lib/utils";
	import { generateFilePreview, MAX_ATTACHMENT_COUNT } from "$lib/utils/file-preview";
	import { isMac } from "$lib/utils/platform";
	import { X } from "@lucide/svelte";
	import type { AttachmentFile, Model } from "@shared/types";
	import { nanoid } from "nanoid";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";
	import { match } from "ts-pattern";
	import { AttachmentThumbnailBar } from "../attachment";
	import ChatActions from "./chat-actions.svelte";
	import ChatInputBoxHeader from "./chat-input-box-header.svelte";
	import SendMessageButton from "./code-agent/send-message-button.svelte";
	import StreamingIndicator from "./streaming-indicator.svelte";
	import { createLogger } from "@shared/logger";

	const logger = createLogger("ui");

	// Get skills that have forceUse=true
	const forcedSkills = $derived(codeAgentState.skills.filter((s) => s.forceUse));
	const maxAttachmentLimit = $derived(codeAgentState.enabled ? 20 : MAX_ATTACHMENT_COUNT);

	// Check if local sandbox is starting (for disabling send button)
	const isLocalSandboxStarting = $derived(
		codeAgentState.type === "local" && localEnvState.sandboxStarting,
	);
	let isVibe = $state(false);

	const { onShortcutAction } = window.electronAPI.shortcut;

	let openModelSelect = $state<() => void>();
	let textareaRef = $state<HTMLTextAreaElement | null>(null);
	let isCodeAgentModelChanging = $state(false);

	// 输入法冷却期：compositionend 后的一段时间内仍然认为正在输入
	// 用于解决 Mac 输入法按 Enter 确认时误触发发送消息的问题
	let compositionEndTime = 0;
	const COMPOSITION_COOLDOWN_MS = 100;

	const shouldShowTaskboardStatus = $derived(
		codeAgentState.inCodeAgentMode &&
			codeAgentTaskboardState.showTaskboardStatusBar &&
			chatState.hasMessages,
	);

	// Redirect to taskboard when user sends message while AI is streaming in Vibe Mode
	const shouldRedirectToTaskboard = $derived(
		codeAgentState.enabled &&
			codeAgentState.inCodeAgentMode &&
			(chatState.isStreaming || chatState.isSubmitted),
	);

	// Button should be enabled for taskboard redirection even during streaming
	// const canSendOrRedirect = $derived(
	// 	chatState.sendMessageEnabled ||
	// 		(shouldRedirectToTaskboard &&
	// 			(chatState.inputValue.trim() !== "" || chatState.attachments.length > 0)),
	// );

	function isInCompositionCooldown(): boolean {
		return Date.now() - compositionEndTime < COMPOSITION_COOLDOWN_MS;
	}

	// 自动聚焦到输入框
	function focusInput() {
		if (textareaRef) {
			// 使用 requestAnimationFrame 确保 DOM 已更新
			requestAnimationFrame(() => {
				// 如果当前焦点在其他输入框/文本区域中，不要抢夺焦点
				const activeEl = document.activeElement;
				const isInOtherInput =
					activeEl &&
					(activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA") &&
					activeEl !== textareaRef;
				if (isInOtherInput) return;

				textareaRef?.focus();
			});
		}
	}

	// 组件挂载时自动聚焦
	onMount(() => {
		focusInput();

		// 监听页面可见性变化（tab 切换时触发）
		const handleVisibilityChange = () => {
			// 当页面变为可见时，自动聚焦输入框
			if (document.visibilityState === "visible") {
				// 延迟一点确保 tab 切换动画完成
				setTimeout(() => {
					focusInput();
				}, 50);
			}
		};

		// 监听窗口获得焦点事件（用户切回应用时）
		const handleWindowFocus = () => {
			focusInput();
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("focus", handleWindowFocus);

		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.removeEventListener("focus", handleWindowFocus);
		};
	});

	// 监听会话 ID 变化，切换会话时自动聚焦
	$effect(() => {
		// 监听 chatState.id 的变化
		const _currentThreadId = chatState.id;
		// 当会话切换时，自动聚焦输入框
		focusInput();
	});

	$effect(() => {
		if (modelPanelState.isOpen && openModelSelect) {
			openModelSelect();
			modelPanelState.close();
		}
	});

	// Check if any providers are properly configured with API keys
	const hasConfiguredProviders = $derived(() => {
		return persistedProviderState.current.some(
			(provider) => provider.enabled && provider.apiKey && provider.apiKey.trim() !== "",
		);
	});

	async function handleGoToModelSettings() {
		await window.electronAPI.windowService.handleOpenSettingsWindow("/settings/model-settings");
	}

	async function handleSendMessage() {
		// Allow taskboard redirection even when normal send is disabled
		if (!chatState.sendMessageEnabled && !shouldRedirectToTaskboard) {
			return;
		}

		const fn = () =>
			match({
				isEmpty: chatState.inputValue.trim() === "" && chatState.attachments.length === 0,
				noProviders: !hasConfiguredProviders(),
				noModel: chatState.selectedModel === null,
			})
				.with({ isEmpty: true }, () => {
					toast.warning(m.toast_empty_message());
				})
				.with({ noProviders: true }, () => {
					toast.info(m.toast_no_provider_configured(), {
						action: {
							label: m.text_button_go_to_settings(),
							onClick: () => handleGoToModelSettings(),
						},
					});
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
				})
				.otherwise(() => {
					// Redirect to taskboard if streaming in Vibe Mode
					if (shouldRedirectToTaskboard) {
						const content = chatState.inputValue.trim();
						const attachments = [...chatState.attachments]; // Clone before clearing
						if (content || attachments.length > 0) {
							codeAgentTaskboardState.addTaskFromChatInput({ content, attachments });
							toast.success(m.taskboard_task_added_from_chat());
							chatState.inputValue = "";
							chatState.attachments = [];
						}
						return;
					}

					// Original send logic
					if (chatState.hasMessages) {
						chatState.sendMessage();
					} else {
						document.startViewTransition(() => chatState.sendMessage());
					}
				});

		if (codeAgentState.enabled && codeAgentState.isFreshTab) {
			await codeAgentSendMessageButtonState.handleCodeAgentFlow(fn);
		} else if (codeAgentState.enabled && codeAgentState.type === "local") {
			// For local mode in non-fresh tabs, only ensure sandbox is running
			const localSandboxResult = await codeAgentSendMessageButtonState.ensureLocalSandboxReady();
			if (!localSandboxResult.isOk) {
				toast.error(localSandboxResult.error ?? m.code_agent_local_sandbox_start_failed());
				return;
			}
			fn();
		} else {
			fn();
		}
	}

	async function handlePaste(event: ClipboardEvent) {
		const items = event.clipboardData?.items;
		if (!items) return;

		const files: File[] = [];

		for (const item of Array.from(items)) {
			if (item.kind === "file") {
				const file = item.getAsFile();
				if (file) files.push(file);
			}
		}

		if (files.length === 0) return;

		event.preventDefault();

		processFiles(files, true);
	}

	function generatePastedFileName(originalName: string): string {
		const timestamp = Date.now();
		const lastDotIndex = originalName.lastIndexOf(".");
		if (lastDotIndex === -1) {
			return `${originalName}-${timestamp}`;
		}
		const name = originalName.slice(0, lastDotIndex);
		const ext = originalName.slice(lastDotIndex);
		return `${name}-${timestamp}${ext}`;
	}

	async function processFiles(files: File[], fromPaste = false) {
		for (const file of files) {
			if (chatState.attachments.length >= maxAttachmentLimit) {
				toast.warning(m.toast_max_attachments_reached());
				break;
			}

			const filePath = (file as File & { path?: string }).path || file.name;
			const attachmentId = nanoid();

			// 为粘贴的文件添加时间戳以区分
			const fileName = fromPaste
				? generatePastedFileName(file.name || `file-${Date.now()}`)
				: file.name || `file-${Date.now()}`;

			// 立即创建附件对象并添加到列表
			const attachment: AttachmentFile = {
				id: attachmentId,
				name: fileName,
				type: file.type,
				size: file.size,
				file,
				preview: undefined, // 预览稍后异步生成
				filePath,
			};

			// 立即添加附件到状态，这样用户可以立即看到
			chatState.addAttachment(attachment);
			// 标记为加载中
			chatState.setAttachmentLoading(attachmentId, true);

			const processFile = async () => {
				const isAbsolutePath =
					filePath.includes("/") || filePath.includes("\\") || /^[a-zA-Z]:/.test(filePath);

				if (!isAbsolutePath) {
					// 如果没有绝对路径，强制读取文件完整内容作为 preview
					// 这样 code-agent-send-message-button-state.ts 就能使用这个内容上传
					try {
						const content = await fileToBase64(file);
						chatState.updateAttachment(attachmentId, { preview: content });
					} catch (e) {
						logger.error("Failed to read file content:", e);
					}
				} else {
					// 正常的预览生成逻辑
					const preview = await generateFilePreview(file);
					chatState.updateAttachment(attachmentId, { preview });
				}

				// 标记加载完成
				chatState.setAttachmentLoading(attachmentId, false);
			};

			processFile();
		}
	}

	async function handleModelSelect(model: Model) {
		if (codeAgentState.inCodeAgentMode) {
			isCodeAgentModelChanging = true;
			const isOK = await codeAgentState.handleCodeAgentModelChange(model);
			if (!isOK) {
				toast.error(m.toast_code_agent_model_change_failed());
			} else {
				chatState.handleSelectedModelChange(model);
			}
			isCodeAgentModelChanging = false;
		} else {
			chatState.handleSelectedModelChange(model);
		}
	}

	const placeholderText = $derived.by(() => {
		const sendMessageShortcut = shortcutSettings.getShortcut("sendMessage");
		const keys = sendMessageShortcut?.keys ?? ["Enter"];
		const modifier = isMac ? "Cmd" : "Ctrl";
		const isEnterSend = keys.length === 1 && keys[0].toLowerCase() === "enter";

		return isEnterSend
			? m.placeholder_input_chat()
			: m.placeholder_input_chat_modifier_send({ modifier });
	});

	// Prevent Enter key from inserting newline when sendMessage shortcut is Enter
	function handleKeydown(e: KeyboardEvent) {
		if (e.isComposing) return;

		// Close quick prompt panel on Escape
		if (e.key === "Escape" && quickPromptState.isOpen) {
			e.preventDefault();
			quickPromptState.close();
			return;
		}

		const sendMessageShortcut = shortcutSettings.getShortcut("sendMessage");
		const keys = sendMessageShortcut?.keys ?? ["Enter"];
		const isEnterSend = keys.length === 1 && keys[0].toLowerCase() === "enter";

		// If sendMessage shortcut is Enter (without modifiers) and user pressed Enter without Shift
		if (isEnterSend && e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
		}
	}

	// Handle input to detect slash command trigger
	function handleInput(e: Event) {
		// Only trigger quick prompt in chat mode, not in vibe mode
		if (codeAgentState.enabled) return;

		const target = e.target as HTMLTextAreaElement;
		const value = target.value;
		const cursorPos = target.selectionStart ?? 0;

		// Check if "/" was just typed at the start or after whitespace
		if (value.length > 0 && cursorPos > 0) {
			const charBeforeCursor = value[cursorPos - 1];
			const charBeforeSlash = cursorPos > 1 ? value[cursorPos - 2] : "";

			// Trigger if "/" is typed at the very start or after a space/newline
			if (
				charBeforeCursor === "/" &&
				(cursorPos === 1 || charBeforeSlash === " " || charBeforeSlash === "\n")
			) {
				quickPromptState.open();
			}
		}
	}

	// Handle quick prompt selection
	function handleQuickPromptSelect(prompt: QuickPrompt) {
		// Remove the trailing "/" that triggered the panel
		let newValue = chatState.inputValue;
		const lastSlashIndex = newValue.lastIndexOf("/");
		if (lastSlashIndex !== -1) {
			// Check if it's at the end or followed only by whitespace
			const afterSlash = newValue.slice(lastSlashIndex + 1).trim();
			if (afterSlash === "") {
				newValue = newValue.slice(0, lastSlashIndex);
			}
		}

		// Set the prompt content (trimmed to remove trailing newlines)
		chatState.inputValue = prompt.prompt.trim();

		// Focus back to textarea
		setTimeout(() => {
			textareaRef?.focus();
			// Move cursor to end
			if (textareaRef) {
				textareaRef.selectionStart = textareaRef.selectionEnd = chatState.inputValue.length;
			}
		}, 50);
	}

	function handleQuickPromptClose() {
		quickPromptState.close();
		textareaRef?.focus();
	}

	function handleIsVibeChange(b: boolean) {
		isVibe = b;
	}

	onMount(() => {
		const unsub = onShortcutAction((action) => {
			if (action.action === "sendMessage" && textareaRef === document.activeElement) {
				if (isMac && isInCompositionCooldown()) return;
				if (
					codeAgentState.enabled &&
					(codeAgentSendMessageButtonState.isChecking ||
						codeAgentSendMessageButtonState.isOpenClawSendDisabled)
				) {
					return;
				}
				handleSendMessage();
			}
		});
		return () => unsub();
	});
</script>

<div class="relative w-full max-w-chat-max-w" data-layoutid="chat-input-container">
	<AttachmentThumbnailBar />
	<div class={cn("absolute left-0 right-0 -top-14 z-10", shouldShowTaskboardStatus && "-top-30")}>
		<StreamingIndicator />
	</div>

	<!-- Quick Prompt Panel Popover -->
	<Popover.Root bind:open={quickPromptState.isOpen}>
		<Popover.Trigger class="sr-only">Quick Prompt Trigger</Popover.Trigger>
		<Popover.Content
			class="w-auto p-0 border-0 shadow-none bg-transparent"
			side="top"
			align="start"
			sideOffset={8}
		>
			<QuickPromptPanel onSelect={handleQuickPromptSelect} onClose={handleQuickPromptClose} />
		</Popover.Content>
	</Popover.Root>

	<div
		class={cn(
			"transition-[color,box-shadow]",
			"flex max-h-chat-max-h min-h-chat-min-h w-full flex-col justify-between rounded-chat border",
			"focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 focus-within:outline-hidden",
			"bg-input overflow-hidden",
		)}
		data-layoutid="chat-input-box"
	>
		<ChatInputBoxHeader onIsVibeChange={handleIsVibeChange} />
		<div class="flex flex-col flex-1 min-h-0 p-chat-pad pb-1.5">
			<div class="min-h-0 flex-1 overflow-auto">
				<Textarea
					id="chat-input-textarea"
					bind:ref={textareaRef}
					class={cn(
						"w-full resize-none p-0",
						"border-none shadow-none focus-within:ring-0 focus-within:outline-hidden focus-visible:ring-0",
					)}
					bind:value={chatState.inputValue}
					placeholder={placeholderText}
					onkeydown={handleKeydown}
					oninput={handleInput}
					oncompositionend={() => (compositionEndTime = Date.now())}
					onpaste={handlePaste}
					disabled={codeAgentState.isDeleted}
				/>
			</div>

			<!-- Forced Skills Display -->
			{#if forcedSkills.length > 0}
				<div class="flex items-start gap-1.5 border-t border-border/50 py-1.5">
					<span class="mt-1 text-xs text-muted-foreground shrink-0">{m.skills_active_label()}:</span
					>
					<div class="max-h-14 flex-1 overflow-y-auto">
						<div class="flex flex-wrap items-center gap-1.5">
							{#each forcedSkills as skill (skill.name)}
								<span
									class="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary"
								>
									{skill.name}
									<button
										type="button"
										class="ml-0.5 rounded hover:bg-primary/20 p-0.5"
										onclick={() => codeAgentState.handleSkillForceUseToggle(skill.name, false)}
									>
										<X class="h-3 w-3" />
									</button>
								</span>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			<div
				class="mt-1.5 flex flex-row items-center justify-between gap-1 min-w-0 overflow-hidden shrink-0"
			>
				<!-- Actions Area (Left) -->

				<div class="flex-1 min-w-0 max-w-[400px]">
					<ChatActions disabled={codeAgentState.isDeleted} />
				</div>

				<!-- Model & Send Area (Right) -->

				<div class="flex-none flex items-center gap-2 min-w-0">
					<div class="shrink-0 min-w-0">
						<ModelSelect
							{isVibe}
							selectedModel={chatState.selectedModel}
							onModelSelect={(model) => handleModelSelect(model)}
						>
							{#snippet trigger({ onclick })}
								{((openModelSelect = () => {
									if (!hasConfiguredProviders()) {
										handleGoToModelSettings();

										return;
									}

									onclick();
								}),
								"")}

								<Button
									variant="ghost"
									class="relative text-sm text-foreground/50 hover:!bg-chat-action-hover min-w-0 max-w-[300px] shrink overflow-visible"
									onclick={() => {
										if (!hasConfiguredProviders()) {
											handleGoToModelSettings();

											return;
										}

										openModelSelect?.();
									}}
									disabled={isCodeAgentModelChanging || codeAgentState.isDeleted}
								>
									{#if !hasConfiguredProviders()}
										<span
											class="absolute top-0 right-0 size-2 rounded-full bg-red-500 pointer-events-none"
										></span>
									{/if}

									{#if isCodeAgentModelChanging}
										<LdrsLoader type="line-spinner" size={16} />
									{:else}
										<p class="truncate">
											{chatState.selectedModel?.name ?? m.text_button_select_model()}
										</p>
									{/if}
								</Button>
							{/snippet}
						</ModelSelect>
					</div>

					<Separator
						orientation="vertical"
						class="shrink-0 rounded-2xl data-[orientation=vertical]:h-1/2 data-[orientation=vertical]:w-0.5"
					/>

					<div class="shrink-0">
						{#if codeAgentState.enabled && codeAgentState.isFreshTab}
							<SendMessageButton onClick={handleSendMessage} />
						{:else}
							<button
								disabled={!chatState.sendMessageEnabled ||
									isLocalSandboxStarting ||
									codeAgentSendMessageButtonState.isChecking ||
									codeAgentSendMessageButtonState.isOpenClawSendDisabled}
								class={cn(
									"shrink-0 flex size-9 items-center cursor-pointer justify-center rounded-[10px] bg-chat-send-message-button text-foreground hover:!bg-chat-send-message-button/80",

									"disabled:cursor-not-allowed disabled:bg-chat-send-message-button/50 disabled:hover:!bg-chat-send-message-button/50",
								)}
								onclick={handleSendMessage}
							>
								{#if isLocalSandboxStarting || codeAgentSendMessageButtonState.isChecking}
									<LdrsLoader type="line-spinner" size={18} />
								{:else}
									<img src={sendMessageIcon} alt="plane" class="size-5" />
								{/if}
							</button>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
