<script lang="ts">
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import * as m from "$lib/paraglide/messages";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { generalSettings } from "$lib/stores/general-settings.state.svelte";
	import { persistedThemeState } from "$lib/stores/theme.state.svelte";
	import type { ChatMessage } from "$lib/types/chat";
	import { cn } from "$lib/utils";
	import { snapdom } from "@zumer/snapdom";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";
	import AssistantMessage from "./assistant-message.svelte";
	import {
		create302Watermark,
		createContentContainer,
		createScreenshotWrapper,
		getScreenshotOptions,
		injectScrollbarStyles,
		prepareMessageContent,
	} from "./screenshot-helpers";
	import UserMessage from "./user-message.svelte";

	interface Props {
		messages: ChatMessage[];
	}

	let { messages }: Props = $props();
	let scrollAreaRef: HTMLElement | null = $state(null);
	let messageListContainer: HTMLElement | null = $state(null);

	let shouldAutoScroll = $state(true);
	let mutationObserver: MutationObserver | null = null;

	const containerClass = $derived.by(() => {
		switch (generalSettings.layoutMode) {
			case "wide":
				return "max-w-[960px] px-8";
			case "ultra-wide":
				return "max-w-[1440px] px-6";
			default:
				return "max-w-[720px]";
		}
	});

	const getViewportElement = (): HTMLElement | null => {
		if (!scrollAreaRef) return null;
		return scrollAreaRef.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement;
	};

	const scrollToBottom = (viewport: HTMLElement): void => {
		viewport.scrollTop = viewport.scrollHeight;
	};

	const isScrolledNearBottom = (viewport: HTMLElement): boolean => {
		const threshold = 50;
		return viewport.scrollTop + viewport.offsetHeight >= viewport.scrollHeight - threshold;
	};

	$effect(() => {
		console.log("be updated");
		const viewport = getViewportElement();
		if (!viewport) return;

		const messagesContainer = viewport.firstElementChild as HTMLElement;
		if (!messagesContainer) return;

		mutationObserver = new MutationObserver(() => {
			if (shouldAutoScroll) {
				scrollToBottom(viewport);
			}
		});

		mutationObserver.observe(messagesContainer, {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
		});

		return () => {
			if (mutationObserver) {
				mutationObserver.disconnect();
				mutationObserver = null;
			}
		};
	});

	$effect(() => {
		console.log("messae");
		const viewport = getViewportElement();
		if (!viewport) return;

		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		messages;

		scrollToBottom(viewport);
	});

	$effect(() => {
		const viewport = getViewportElement();
		if (!viewport) return;

		const handleScroll = (): void => {
			shouldAutoScroll = isScrolledNearBottom(viewport);
		};

		viewport.addEventListener("scroll", handleScroll, { passive: true });

		return () => {
			viewport.removeEventListener("scroll", handleScroll);
		};
	});

	onMount(() => {
		const handleScreenshot = async (data: { threadId: string }) => {
			if (data.threadId === chatState.id && messageListContainer) {
				const loadingToast = toast.loading(m.screenshot_generating());

				// 使用 try-finally 确保清理
				let wrapper: HTMLDivElement | null = null;

				try {
					// 获取当前主题的暗黑模式状态
					const isDarkMode = persistedThemeState.current.shouldUseDarkColors;

					// 1. 提前准备所有元素
					wrapper = createScreenshotWrapper();
					const contentContainer = createContentContainer();
					const messageContent = prepareMessageContent(messageListContainer);
					const watermark = create302Watermark(isDarkMode);
					const scrollbarStyles = injectScrollbarStyles(isDarkMode);

					// 2. 插入 DOM
					contentContainer.appendChild(messageContent);
					wrapper.appendChild(contentContainer);
					wrapper.appendChild(watermark);
					wrapper.appendChild(scrollbarStyles);
					document.body.appendChild(wrapper);

					// 3. 等待样式计算完成
					await new Promise((resolve) => {
						requestAnimationFrame(() => {
							requestAnimationFrame(resolve);
						});
					});

					// 4. 执行截图
					const options = getScreenshotOptions(isDarkMode);
					const result = await snapdom(wrapper, options);

					// 5. 下载
					await result.download({
						format: "png",
						filename: chatState.title,
					});

					toast.success(m.screenshot_success(), { id: loadingToast });
				} catch (error) {
					console.error("Screenshot failed:", error);
					toast.error(m.screenshot_failed(), { id: loadingToast });
				} finally {
					// 6. 确保清理 DOM
					if (wrapper && wrapper.parentNode) {
						document.body.removeChild(wrapper);
					}
				}
			}
		};

		const cleanup = window.electronAPI?.onScreenshotTriggered?.(handleScreenshot);

		return () => {
			cleanup?.();
		};
	});
</script>

<ScrollArea bind:ref={scrollAreaRef} class="h-full w-full pt-5">
	<div class="flex w-full justify-center">
		<div bind:this={messageListContainer} class={cn("w-full space-y-4", containerClass)}>
			{#each messages as message (message.id)}
				{#if message.role === "user"}
					<UserMessage message={{ ...message, role: "user" as const }} />
				{:else if message.role === "assistant"}
					<AssistantMessage message={{ ...message, role: "assistant" as const }} />
				{/if}
			{/each}
		</div>
	</div>
</ScrollArea>
