<script lang="ts">
	import sendMessageIcon from "$lib/assets/send-message.svg";
	import { ModelSelect } from "$lib/components/buss/model-select";
	import { Button } from "$lib/components/ui/button";
	import { Separator } from "$lib/components/ui/separator";
	import { Textarea } from "$lib/components/ui/textarea";
	import { m } from "$lib/paraglide/messages.js";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { modelPanelState } from "$lib/stores/model-panel-state.svelte";
	import { persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { cn } from "$lib/utils";
	import { generateFilePreview, MAX_ATTACHMENT_COUNT } from "$lib/utils/file-preview";
	import type { AttachmentFile } from "@shared/types";
	import { nanoid } from "nanoid";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";
	import { match } from "ts-pattern";
	import { AttachmentThumbnailBar } from "../attachment";
	import ChatActions from "./chat-actions.svelte";
	import StreamingIndicator from "./streaming-indicator.svelte";

	let openModelSelect = $state<() => void>();
	let isComposing = $state(false); // 跟踪输入法composition状态
	let textareaRef = $state<HTMLTextAreaElement | null>(null);

	// 自动聚焦到输入框
	function focusInput() {
		if (textareaRef) {
			// 使用 requestAnimationFrame 确保 DOM 已更新
			requestAnimationFrame(() => {
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
		const currentThreadId = chatState.id;
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

	function handleSendMessage() {
		// 如果不满足发送条件，直接返回，不执行任何操作
		if (!chatState.sendMessageEnabled) {
			return;
		}

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
				if (chatState.hasMessages) {
					chatState.sendMessage();
				} else {
					document.startViewTransition(() => chatState.sendMessage());
				}
			});
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

		processFiles(files);
	}

	async function processFiles(files: File[]) {
		for (const file of files) {
			if (chatState.attachments.length >= MAX_ATTACHMENT_COUNT) {
				toast.warning(
					m.toast_max_attachments_reached?.() || `已达到最大附件数量：${MAX_ATTACHMENT_COUNT}`,
				);
				break;
			}

			const filePath = (file as File & { path?: string }).path || file.name;
			const attachmentId = nanoid();

			// 立即创建附件对象并添加到列表
			const attachment: AttachmentFile = {
				id: attachmentId,
				name: file.name || `file-${Date.now()}`,
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

			// 异步生成预览（不阻塞UI）
			generateFilePreview(file).then((preview) => {
				// 更新附件的预览
				chatState.updateAttachment(attachmentId, { preview });
				// 标记加载完成
				chatState.setAttachmentLoading(attachmentId, false);
			});
		}
	}
</script>

<div class="relative w-full max-w-chat-max-w" data-layoutid="chat-input-container">
	<AttachmentThumbnailBar />
	<div class="absolute left-0 right-0 -top-14 z-10">
		<StreamingIndicator />
	</div>
	<div
		class={cn(
			"transition-[color,box-shadow]",
			"flex max-h-chat-max-h min-h-chat-min-h w-full flex-col justify-between rounded-chat border p-chat-pad pb-1.5",
			"focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 focus-within:outline-hidden",
			"bg-input",
		)}
		data-layoutid="chat-input-box"
	>
		<Textarea
			bind:ref={textareaRef}
			class={cn(
				"w-full resize-none p-0",
				"border-none shadow-none focus-within:ring-0 focus-within:outline-hidden focus-visible:ring-0",
			)}
			bind:value={chatState.inputValue}
			placeholder={m.placeholder_input_chat()}
			onkeydown={(e) => {
				if (e.key === "Enter" && !e.shiftKey && !isComposing) {
					handleSendMessage();
					e.preventDefault();
				}
			}}
			oncompositionstart={() => {
				isComposing = true;
			}}
			oncompositionend={() => {
				isComposing = false;
			}}
			onpaste={handlePaste}
		/>

		<div class="mt-1.5 flex flex-row justify-between">
			<ChatActions />

			<div class="flex items-center gap-2">
				<ModelSelect
					selectedModel={chatState.selectedModel}
					onModelSelect={(model) => chatState.handleSelectedModelChange(model)}
				>
					{#snippet trigger({ onclick })}
						{((openModelSelect = () => {
							if (!hasConfiguredProviders()) {
								toast.info(m.toast_no_provider_configured(), {
									action: {
										label: m.text_button_go_to_settings(),
										onClick: () => handleGoToModelSettings(),
									},
								});
								return;
							}
							onclick();
						}),
						"")}
						<Button
							variant="ghost"
							class="text-sm text-foreground/50 hover:!bg-chat-action-hover max-w-[200px]"
							onclick={() => {
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
							}}
						>
							<p class="truncate">
								{chatState.selectedModel?.name ?? m.text_button_select_model()}
							</p>
						</Button>
					{/snippet}
				</ModelSelect>

				<Separator
					orientation="vertical"
					class="rounded-2xl data-[orientation=vertical]:h-1/2 data-[orientation=vertical]:w-0.5"
				/>

				<button
					disabled={!chatState.sendMessageEnabled}
					class={cn(
						"flex size-9 items-center justify-center rounded-[10px] bg-chat-send-message-button text-foreground hover:!bg-chat-send-message-button/80",
						"disabled:cursor-not-allowed disabled:bg-chat-send-message-button/50 disabled:hover:!bg-chat-send-message-button/50",
					)}
					onclick={handleSendMessage}
				>
					<img src={sendMessageIcon} alt="plane" class="size-5" />
				</button>
			</div>
		</div>
	</div>
</div>
