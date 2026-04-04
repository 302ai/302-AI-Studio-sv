<script lang="ts">
	import { browser } from "$app/environment";
	import ChatMinimap from "$lib/components/buss/chat/chat-minimap.svelte";
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import * as m from "$lib/paraglide/messages";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { generalSettings } from "$lib/stores/general-settings.state.svelte";
	import { searchHighlightState } from "$lib/stores/search-highlight-state.svelte";
	import { persistedThemeState } from "$lib/stores/theme.state.svelte";
	import type { ChatMessage } from "$lib/types/chat";
	import { cn } from "$lib/utils";
	import { ArrowDown, ArrowUp } from "@lucide/svelte";
	import { createLogger } from "@shared/logger";
	import { domToPng } from "modern-screenshot";
	import { onMount, tick } from "svelte";
	import { toast } from "svelte-sonner";
	import AssistantMessage from "./assistant-message.svelte";
	import CompressionBanner from "./compression-banner.svelte";
	import {
		create302Watermark,
		createContentContainer,
		createScreenshotWrapper,
		getScreenshotOptions,
		injectScrollbarStyles,
		prepareMessageContent,
	} from "./screenshot-helpers";
	import UserMessage from "./user-message.svelte";

	const logger = createLogger("ui");

	interface Props {
		messages: ChatMessage[];
	}

	let { messages }: Props = $props();
	let scrollAreaRef: HTMLElement | null = $state(null);
	let messageListContainer: HTMLElement | null = $state(null);

	let shouldAutoScroll = $state(true);
	let mutationObserver: MutationObserver | null = null;
	let showScrollToTop = $state(false);
	let showScrollToBottom = $state(false);
	let showMinimap = $state(false);
	let searchHighlightTimeout: ReturnType<typeof setTimeout> | null = null;
	let appliedKeyword = $state("");
	let lastAppliedOptions = $state({ caseSensitive: false, wholeWord: false, regex: false });

	// Initialize search highlight state immediately (before effects run)
	if (browser) {
		searchHighlightState.initializeForTab();
		if (searchHighlightState.searchKeyword) {
			chatState.handleSearchInputStateChange(true);
		}
	}

	/**
	 * Expand all collapsed code blocks before searching
	 */
	function expandAllCollapsedCodeBlocks(): void {
		const codeBlockWrappers = document.querySelectorAll("[data-code-block-wrapper]");

		for (const wrapper of codeBlockWrappers) {
			const preElements = wrapper.querySelectorAll("pre");
			for (const pre of preElements) {
				const classList = pre.classList;
				const hasMaxH = Array.from(classList).some((cls) => cls.startsWith("max-h-"));

				if (hasMaxH) {
					// Find the collapse toggle button by finding button with ChevronDown svg
					const buttons = wrapper.querySelectorAll("button");
					for (const btn of buttons) {
						const svg = btn.querySelector("svg");
						if (svg) {
							// Check if this is the collapse toggle (has rotate-180 class when collapsed)
							const svgClasses = svg.getAttribute("class") || "";
							if (svgClasses.includes("rotate-180")) {
								// This is a collapsed button, click to expand
								(btn as HTMLElement).click();
								break;
							}
						}
					}
				}
			}
		}
	}

	/**
	 * Highlight search keywords in DOM by wrapping matching text nodes with <mark> tags
	 */
	function highlightKeywordInDOM(container: HTMLElement, keyword: string): void {
		if (!keyword) return;

		const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
		const textNodes: Text[] = [];
		let node;
		while ((node = walker.nextNode())) {
			textNodes.push(node as Text);
		}

		const caseSensitive = searchHighlightState.caseSensitive;
		const wholeWord = searchHighlightState.wholeWord;
		const useRegex = searchHighlightState.regex;

		let pattern: string;
		if (useRegex) {
			pattern = keyword;
		} else {
			const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			pattern = wholeWord ? `\\b${escapedKeyword}\\b` : escapedKeyword;
		}

		let flags = caseSensitive ? "g" : "gi";
		let regex: RegExp;
		try {
			regex = new RegExp(`(${pattern})`, flags);
		} catch (e) {
			logger.error("Invalid regex pattern:", e);
			return;
		}

		for (const textNode of textNodes) {
			const text = textNode.textContent || "";
			if (regex.test(text)) {
				regex.lastIndex = 0;
				const parent = textNode.parentNode;
				if (
					!parent ||
					parent.nodeName === "SCRIPT" ||
					parent.nodeName === "STYLE" ||
					parent.nodeName === "MARK"
				)
					continue;
				const fragment = document.createDocumentFragment();
				let lastIndex = 0;
				let match;
				while ((match = regex.exec(text)) !== null) {
					if (match.index > lastIndex) {
						fragment.appendChild(
							document.createTextNode(text.slice(lastIndex, match.index)),
						);
					}
					const mark = document.createElement("mark");
					mark.className = "search-highlight";
					mark.textContent = match[1];
					fragment.appendChild(mark);
					lastIndex = match.index + match[0].length;
				}
				if (lastIndex < text.length) {
					fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
				}
				parent.replaceChild(fragment, textNode);
			}
		}
	}

	let messageBoxEl: HTMLDivElement | null = null;

	function clearSearchHighlights(container: HTMLElement): void {
		const highlights = container.querySelectorAll("mark.search-highlight");
		logger.debug("Search highlights found:", highlights.length);
		for (const mark of highlights) {
			const text = document.createTextNode(mark.textContent ?? "");
			mark.replaceWith(text);
			if (messageBoxEl != null) {
				messageBoxEl!.normalize();
			}
		}
	}

	const containerClass = $derived.by(() => {
		switch (generalSettings.layoutMode) {
			case "wide":
				return "max-w-[960px] px-8";
			case "ultra-wide":
				return "max-w-[1440px] px-6";
			default:
				return "max-w-[720px] px-4";
		}
	});

	const getViewportElement = (): HTMLElement | null => {
		if (!scrollAreaRef) return null;
		return scrollAreaRef.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement;
	};

	const scrollToBottom = (viewport: HTMLElement): void => {
		viewport.scrollTop = viewport.scrollHeight;
	};

	const _scrollToTop = (viewport: HTMLElement): void => {
		viewport.scrollTop = 0;
	};

	const scrollToBottomSmooth = (): void => {
		const viewport = getViewportElement();
		if (!viewport) return;
		viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
	};

	const scrollToTopSmooth = (): void => {
		const viewport = getViewportElement();
		if (!viewport) return;
		viewport.scrollTo({ top: 0, behavior: "smooth" });
	};

	const isScrolledNearBottom = (viewport: HTMLElement): boolean => {
		const threshold = 50;
		return viewport.scrollTop + viewport.offsetHeight >= viewport.scrollHeight - threshold;
	};

	const isScrolledNearTop = (viewport: HTMLElement): boolean => {
		const threshold = 100;
		return viewport.scrollTop <= threshold;
	};

	const updateScrollButtonsVisibility = (viewport: HTMLElement): void => {
		showScrollToTop = !isScrolledNearTop(viewport);
		showScrollToBottom = !isScrolledNearBottom(viewport);
		// Show minimap when there are messages and content is scrollable
		const hasScroll = viewport.scrollHeight > viewport.offsetHeight;
		showMinimap = messages.length > 0 && hasScroll;
	};

	/**
	 * Scroll to the first message containing the search keyword (fallback)
	 */
	const scrollToFirstMatch = (keyword: string): void => {
		if (!messageListContainer) return;

		const lowerKeyword = keyword.toLowerCase();
		const messageElements = messageListContainer.querySelectorAll("[data-message-id]");

		for (const el of messageElements) {
			const textContent = el.textContent?.toLowerCase() || "";
			if (textContent.includes(lowerKeyword)) {
				el.scrollIntoView({ behavior: "smooth", block: "center" });
				break;
			}
		}
	};

	$effect(() => {
		const viewport = getViewportElement();
		if (!viewport) return;

		const messagesContainer = viewport.firstElementChild as HTMLElement;
		if (!messagesContainer) return;

		mutationObserver = new MutationObserver(() => {
			// Don't auto-scroll if we have a search keyword active
			if (shouldAutoScroll && !searchHighlightState.searchKeyword) {
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
		const viewport = getViewportElement();
		if (!viewport) return;

		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		messages;

		// Don't scroll to bottom if we have a search keyword - we'll scroll to the match instead
		if (searchHighlightState.searchKeyword) {
			return;
		}

		scrollToBottom(viewport);
	});

	$effect(() => {
		const viewport = getViewportElement();
		if (!viewport) return;

		const handleScroll = (): void => {
			shouldAutoScroll = isScrolledNearBottom(viewport);
			updateScrollButtonsVisibility(viewport);
		};

		viewport.addEventListener("scroll", handleScroll, { passive: true });

		// Initial visibility check
		updateScrollButtonsVisibility(viewport);

		return () => {
			viewport.removeEventListener("scroll", handleScroll);
		};
	});

	$effect(() => {
		const keyword = searchHighlightState.searchKeyword;
		const caseSensitive = searchHighlightState.caseSensitive;
		const wholeWord = searchHighlightState.wholeWord;
		const useRegex = searchHighlightState.regex;

		// Reset appliedKeyword when search is cleared
		if (!keyword) {
			// Immediately clear highlights when search is cleared
			if (messageListContainer) {
				clearSearchHighlights(messageListContainer);
			}
			appliedKeyword = "";
			return;
		}

		// Skip if keyword and options haven't changed
		const currentOptions = { caseSensitive, wholeWord, regex: useRegex };
		const optionsChanged =
			lastAppliedOptions.caseSensitive !== currentOptions.caseSensitive ||
			lastAppliedOptions.wholeWord !== currentOptions.wholeWord ||
			lastAppliedOptions.regex !== currentOptions.regex;

		if (keyword === appliedKeyword && !optionsChanged) {
			return;
		}

		if (messages.length === 0 || !messageListContainer) {
			return;
		}

		// Clear previous timeout to avoid race conditions
		if (searchHighlightTimeout) {
			clearTimeout(searchHighlightTimeout);
		}

		// Debounce to avoid race conditions on rapid input
		// Note: Don't update appliedKeyword here - wait until timeout completes
		const keywordForTimeout = keyword;
		const optionsForTimeout = { caseSensitive, wholeWord, regex: useRegex };
		searchHighlightTimeout = setTimeout(async () => {
			// Check if the keyword is still valid (not cleared or changed)
			if (searchHighlightState.searchKeyword !== keywordForTimeout) {
				return;
			}

			if (!messageListContainer) return;

			// Clear existing highlights first
			clearSearchHighlights(messageListContainer);

			// Expand all collapsed code blocks before searching
			expandAllCollapsedCodeBlocks();

			// Wait for DOM to update after clearing and expanding code blocks
			await tick();
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Apply new highlighting
			highlightKeywordInDOM(messageListContainer, keywordForTimeout);

			// Only update appliedKeyword after successful completion
			appliedKeyword = keywordForTimeout;
			lastAppliedOptions = optionsForTimeout;

			// Wait for DOM to update after highlighting
			await tick();

			// Scroll to first highlight mark using viewport (instant, no animation)
			const highlightMark = messageListContainer.querySelector("mark.search-highlight");
			if (highlightMark) {
				const viewport = getViewportElement();
				if (viewport) {
					const markRect = highlightMark.getBoundingClientRect();
					const viewportRect = viewport.getBoundingClientRect();
					const scrollTop =
						viewport.scrollTop +
						markRect.top -
						viewportRect.top -
						viewport.offsetHeight / 2 +
						markRect.height / 2;
					viewport.scrollTo({ top: Math.max(0, scrollTop), behavior: "instant" });
				}
			} else {
				scrollToFirstMatch(keywordForTimeout);
			}
			searchHighlightState.markScrolled();
		}, 100);
	});

	// Effect to re-apply highlighting when messages change (e.g., new messages arrive)
	$effect(() => {
		const keyword = searchHighlightState.searchKeyword;
		// Track messages to trigger effect on changes
		if (!keyword || !messageListContainer) return;

		// Only re-apply if keyword matches current search state
		if (keyword !== appliedKeyword) return;

		// Check if highlights already exist
		const existingHighlights = messageListContainer.querySelectorAll("mark.search-highlight");
		if (existingHighlights.length > 0) return;

		// Wait for DOM update after messages change
		setTimeout(() => {
			if (!messageListContainer || !keyword) return;
			if (keyword !== appliedKeyword) return;

			clearSearchHighlights(messageListContainer);
			highlightKeywordInDOM(messageListContainer, keyword);
		}, 50);
	});

	onMount(() => {
		const cleanupSearchNavigate = window.electronAPI?.onSidebarSearchNavigate?.((data) => {
			if (data.threadId !== chatState.id) return;
			searchHighlightState.applySearchKeyword(data.query);
		});

		const handleScreenshot = async (data: { threadId: string }) => {
			if (data.threadId === chatState.id && messageListContainer) {
				// 检查是否有消息（使用内存中的实时数据）
				if (messages.length === 0) {
					toast.warning(m.screenshot_no_messages());
					return;
				}

				const loadingToast = toast.loading(m.screenshot_generating());

				// 使用 try-finally 确保清理
				let wrapper: HTMLDivElement | null = null;

				try {
					// 获取当前主题的暗黑模式状态
					const isDarkMode = persistedThemeState.current.shouldUseDarkColors;

					// 1. 临时禁用页面滚动
					const originalOverflow = document.body.style.overflow;
					document.body.style.overflow = "hidden";

					// 2. 提前准备所有元素
					wrapper = createScreenshotWrapper();
					const contentContainer = createContentContainer();
					const messageContent = prepareMessageContent(messageListContainer);
					const watermark = create302Watermark(isDarkMode);
					const scrollbarStyles = injectScrollbarStyles(isDarkMode);

					// 3. 插入 DOM
					contentContainer.appendChild(messageContent);
					wrapper.appendChild(contentContainer);
					wrapper.appendChild(watermark);
					wrapper.appendChild(scrollbarStyles);
					document.body.appendChild(wrapper);

					// 4. 等待样式计算完成
					await new Promise((resolve) => {
						requestAnimationFrame(() => {
							requestAnimationFrame(resolve);
						});
					});

					// 5. 执行截图
					const options = getScreenshotOptions(isDarkMode);
					const dataUrl = await domToPng(wrapper, options);

					// 6. 恢复页面滚动
					document.body.style.overflow = originalOverflow;

					// 7. 下载
					const link = document.createElement("a");
					link.download = `${chatState.title}.png`;
					link.href = dataUrl;
					link.click();

					toast.success(m.screenshot_success(), { id: loadingToast });
				} catch (error) {
					logger.error("Screenshot failed:", error);
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
			cleanupSearchNavigate?.();
			cleanup?.();
		};
	});
</script>

<div class="relative h-full w-full" bind:this={messageBoxEl}>
	<ScrollArea
		bind:ref={scrollAreaRef}
		class={cn(
			"h-full w-full pt-12",
			showMinimap && "[&_[data-slot='scroll-area-scrollbar']]:hidden",
		)}
	>
		<div class="flex w-full justify-center">
			<div bind:this={messageListContainer} class={cn("w-full space-y-4", containerClass)}>
				<CompressionBanner />
				{#each messages as message, index (message.id + "-" + index)}
					{#if message.role === "user"}
						<UserMessage message={{ ...message, role: "user" as const }} />
						<!-- <SandboxStatusCallout show={index === 0 && messages.length === 1} /> -->
					{:else if message.role === "assistant"}
						<AssistantMessage message={{ ...message, role: "assistant" as const }} />
					{/if}
				{/each}
			</div>
		</div>
	</ScrollArea>

	<!-- Chat Minimap -->
	{#if showMinimap}
		<ChatMinimap
			{messages}
			viewport={getViewportElement()}
			scrollContainer={messageListContainer}
			class="animate-in fade-in slide-in-from-right-4 duration-300"
		/>
	{/if}

	<!-- Scroll buttons -->
	<div
		class="pointer-events-none absolute bottom-4 flex flex-col gap-2 transition-all duration-300"
		class:right-[80px]={showMinimap}
		class:right-4={!showMinimap}
		style="z-index: 20;"
	>
		{#if showScrollToTop}
			<button
				type="button"
				onclick={scrollToTopSmooth}
				title={m.scroll_to_top()}
				class="pointer-events-auto flex cursor-pointer h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg transition-all hover:bg-gray-50 hover:shadow-xl dark:bg-gray-800 dark:hover:bg-gray-700"
			>
				<ArrowUp class="h-5 w-5 text-gray-700 dark:text-gray-200" />
			</button>
		{/if}
		{#if showScrollToBottom}
			<button
				type="button"
				onclick={scrollToBottomSmooth}
				title={m.scroll_to_bottom()}
				class="pointer-events-auto flex cursor-pointer h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg transition-all hover:bg-gray-50 hover:shadow-xl dark:bg-gray-800 dark:hover:bg-gray-700"
			>
				<ArrowDown class="h-5 w-5 text-gray-700 dark:text-gray-200" />
			</button>
		{/if}
	</div>
</div>
