<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import * as Sidebar from "$lib/components/ui/sidebar";
	import { useSidebar } from "$lib/components/ui/sidebar";
	import { m } from "$lib/paraglide/messages";
	import { getLocale } from "$lib/paraglide/runtime";
	import { agentPreviewState } from "$lib/stores/agent-preview-state.svelte";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import { searchHighlightState } from "$lib/stores/search-highlight-state.svelte";
	import { cn } from "$lib/utils";
	import {
		CaseSensitive,
		ChevronDown,
		ChevronUp,
		Code,
		Ghost,
		MessageCircleQuestionMark,
		ScanSearch,
		Search,
		Server,
		Settings,
		WholeWord,
		X,
	} from "@lucide/svelte";
	import { onMount } from "svelte";

	async function handleNewSettingsTab() {
		await window.electronAPI.windowService.handleOpenSettingsWindow();
	}

	async function handleOpenHelpDocs() {
		const locale = getLocale();
		const lang = locale === "en" ? "en" : "zh";
		const helpDocsUrl = `https://studio.302.ai/${lang}/docs`;

		await window.electronAPI.tabService.handleNewTab(
			"Help Docs",
			"helpDocs",
			true,
			helpDocsUrl,
		);
	}

	// Check if agent preview button (with full tabs) should be shown
	const showAgentPreviewButton = $derived(
		codeAgentState.enabled &&
			((codeAgentState.currentAgentId === "claude-code" &&
				codeAgentState.sandboxId !== "" &&
				codeAgentState.currentSessionId !== "") ||
				(codeAgentState.currentAgentId === "open-claw" &&
					codeAgentState.currentSessionId !== "")),
	);

	// Handle agent preview toggle (full mode with sandbox)
	function handleAgentPreviewToggle() {
		if (agentPreviewState.isVisible) {
			agentPreviewState.closePreview();
		} else {
			if (codeAgentState.currentAgentId === "open-claw") {
				agentPreviewState.openPreview(codeAgentState.type);
			} else {
				const sandboxId = codeAgentState.sandboxId;
				if (sandboxId) {
					agentPreviewState.openPreview(sandboxId);
				}
			}
		}
	}

	// Handle skills-only mode toggle (no sandbox required)
	// function handleSkillsOnlyToggle() {
	// 	if (agentPreviewState.isVisible && agentPreviewState.isSkillsOnlyMode) {
	// 		agentPreviewState.closePreview();
	// 	} else {
	// 		agentPreviewState.openSkillsOnlyMode();
	// 	}
	// }

	let searchInputValue = $state("");
	let totalMatches = $state(0);
	let currentMatchIndex = $state(0);
	let searchInputRef: HTMLInputElement | null = $state(null);
	let lastAppliedKeyword = $state("");
	let matchCountTimeout: ReturnType<typeof setTimeout> | null = null;
	let matchCountObserver: MutationObserver | null = null;
	let wasSearchInputOpened = $state(false);

	let caseSensitive = $state(false);
	let wholeWord = $state(false);
	let useRegex = $state(false);
	let searchPanelRightOffset = $state(0);
	let searchPanelRef: HTMLDivElement | null = $state(null);

	function updateSearchPanelPosition() {
		if (!chatState.isSearchInput || typeof window === "undefined" || !searchPanelRef) {
			searchPanelRightOffset = 0;
			return;
		}

		const sidebar = document.querySelector('[data-sidebar="sidebar"]') as HTMLElement | null;
		const sidebarRight = sidebar?.getBoundingClientRect().right ?? 0;
		const safeGap = 12;
		const panelRect = searchPanelRef.getBoundingClientRect();
		const overflowLeft = sidebarRight + safeGap - panelRect.left;
		searchPanelRightOffset = overflowLeft > 0 ? -overflowLeft : 0;
	}

	function toggleCaseSensitive() {
		caseSensitive = !caseSensitive;
		searchHighlightState.setCaseSensitive(caseSensitive);
		reapplySearch();
	}

	function toggleWholeWord() {
		wholeWord = !wholeWord;
		searchHighlightState.setWholeWord(wholeWord);
		reapplySearch();
	}

	function toggleRegex() {
		useRegex = !useRegex;
		searchHighlightState.setRegex(useRegex);
		reapplySearch();
	}

	function reapplySearch() {
		if (searchInputValue.trim()) {
			searchHighlightState.applySearchKeyword(searchInputValue.trim());
		}
	}

	$effect(() => {
		if (chatState.isSearchInput && searchInputRef) {
			searchInputRef.focus();
			requestAnimationFrame(updateSearchPanelPosition);
		}
	});

	$effect(() => {
		if (
			chatState.isSearchInput &&
			!wasSearchInputOpened &&
			searchHighlightState.searchKeyword
		) {
			searchInputValue = searchHighlightState.searchKeyword;
			wasSearchInputOpened = true;
		}
		if (!chatState.isSearchInput) {
			wasSearchInputOpened = false;
		}
	});

	$effect(() => {
		const trimmed = searchInputValue.trim();
		if (trimmed && trimmed !== lastAppliedKeyword) {
			lastAppliedKeyword = trimmed;
			searchHighlightState.applySearchKeyword(trimmed);
		} else if (!trimmed && lastAppliedKeyword) {
			lastAppliedKeyword = "";
			searchHighlightState.clearSearch();
			totalMatches = 0;
			currentMatchIndex = 0;
		}
	});

	$effect(() => {
		if (!chatState.isSearchInput) {
			searchHighlightState.clearSearch();
			searchInputValue = "";
			totalMatches = 0;
			currentMatchIndex = 0;
			caseSensitive = false;
			wholeWord = false;
			useRegex = false;
			return;
		}

		if (!searchInputValue.trim()) return;

		// Clear previous timeout and observer
		if (matchCountTimeout) {
			clearTimeout(matchCountTimeout);
		}
		if (matchCountObserver) {
			matchCountObserver.disconnect();
		}

		const timeout = setTimeout(() => {
			const marks = document.querySelectorAll("mark.search-highlight");
			totalMatches = marks.length;
			if (totalMatches > 0 && currentMatchIndex === 0) {
				currentMatchIndex = 1;
			}
		}, 100);

		const observer = new MutationObserver(() => {
			const marks = document.querySelectorAll("mark.search-highlight");
			totalMatches = marks.length;
			if (totalMatches > 0 && currentMatchIndex === 0) {
				currentMatchIndex = 1;
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["class"],
		});

		matchCountTimeout = timeout;
		matchCountObserver = observer;

		return () => {
			clearTimeout(timeout);
			observer.disconnect();
		};
	});

	function handleSearchInputKeydown(event: KeyboardEvent) {
		if (event.key === "Escape") {
			chatState.handleSearchInputStateChange(false);
		} else if (event.key === "Enter") {
			if (event.shiftKey) {
				handlePrevMatch();
			} else {
				handleNextMatch();
			}
		} else if (event.key === "ArrowDown") {
			event.preventDefault();
			handleNextMatch();
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			handlePrevMatch();
		}
	}

	function handleClearSearch() {
		searchInputValue = "";
		searchHighlightState.clearSearch();
		totalMatches = 0;
		currentMatchIndex = 0;
		caseSensitive = false;
		wholeWord = false;
		useRegex = false;
		chatState.handleSearchInputStateChange(false);
	}

	function handleNextMatch() {
		if (totalMatches === 0) return;

		const marks = document.querySelectorAll("mark.search-highlight") as NodeListOf<HTMLElement>;
		if (marks.length === 0) return;

		currentMatchIndex = currentMatchIndex >= totalMatches ? 1 : currentMatchIndex + 1;
		scrollToMatch(marks, currentMatchIndex - 1);
	}

	function handlePrevMatch() {
		if (totalMatches === 0) return;

		const marks = document.querySelectorAll("mark.search-highlight") as NodeListOf<HTMLElement>;
		if (marks.length === 0) return;

		currentMatchIndex = currentMatchIndex <= 1 ? totalMatches : currentMatchIndex - 1;
		scrollToMatch(marks, currentMatchIndex - 1);
	}

	function scrollToMatch(marks: NodeListOf<HTMLElement>, index: number) {
		const mark = marks[index];
		if (!mark) return;

		const viewport = document.querySelector(
			'[data-slot="scroll-area-viewport"]',
		) as HTMLElement;
		if (!viewport) {
			mark.scrollIntoView({ behavior: "smooth", block: "center" });
			return;
		}

		const markRect = mark.getBoundingClientRect();
		const viewportRect = viewport.getBoundingClientRect();
		const scrollTop =
			viewport.scrollTop +
			markRect.top -
			viewportRect.top -
			viewport.offsetHeight / 2 +
			markRect.height / 2;
		viewport.scrollTo({ top: Math.max(0, scrollTop), behavior: "smooth" });

		mark.classList.add("search-highlight-current");
		marks.forEach((m, i) => {
			if (i !== index) {
				m.classList.remove("search-highlight-current");
			}
		});
	}

	onMount(() => {
		const cleanupSearchNavigate = window.electronAPI?.onSidebarSearchNavigate?.((data) => {
			if (data.threadId !== chatState.id) return;
			chatState.handleSearchInputStateChange(true);
			searchInputValue = data.query;
		});

		const handleResize = () => updateSearchPanelPosition();
		const sidebar = document.querySelector('[data-sidebar="sidebar"]') as HTMLElement | null;
		const sidebarResizeObserver = sidebar ? new ResizeObserver(handleResize) : null;
		if (sidebar) sidebarResizeObserver?.observe(sidebar);
		window.addEventListener("resize", handleResize);

		return () => {
			cleanupSearchNavigate?.();
			sidebarResizeObserver?.disconnect();
			window.removeEventListener("resize", handleResize);
		};
	});
</script>

<div
	class="absolute top-0 left-0 right-0 z-40 flex h-12 w-full flex-row items-center justify-between bg-transparent px-2"
>
	<ButtonWithTooltip
		tooltip={useSidebar().state === "expanded"
			? m.title_sidebar_close()
			: m.title_sidebar_open()}
		tooltipSide="bottom"
	>
		<Sidebar.Trigger class="hover:!bg-icon-btn-hover size-9 [&_svg]:!size-5" />
	</ButtonWithTooltip>

	<div class="flex flex-row items-center gap-2">
		{#if showAgentPreviewButton}
			<!-- Full agent preview mode (with sandbox) -->
			<ButtonWithTooltip
				class={cn(
					"hover:!bg-icon-btn-hover",
					agentPreviewState.isVisible &&
						!agentPreviewState.isSkillsOnlyMode &&
						"!bg-icon-btn-active hover:!bg-icon-btn-active",
				)}
				tooltipSide="bottom"
				tooltip={agentPreviewState.isVisible && !agentPreviewState.isSkillsOnlyMode
					? m.tooltip_close_agent_preview()
					: m.tooltip_open_agent_preview()}
				onclick={handleAgentPreviewToggle}
			>
				<Server
					class={cn(
						"size-5",
						agentPreviewState.isVisible &&
							!agentPreviewState.isSkillsOnlyMode &&
							"!text-icon-btn-active-fg",
					)}
				/>
			</ButtonWithTooltip>
		{/if}

		<div class="relative">
			{#if chatState.hasMessages}
				<ButtonWithTooltip
					class={cn(
						"hover:!bg-icon-btn-hover",
						chatState.isSearchInput &&
							"!bg-icon-btn-active !text-icon-btn-active-fg hover:!bg-icon-btn-active hover:!text-icon-btn-active-fg",
					)}
					tooltipSide="bottom"
					tooltip={m.tooltip_search_content()}
					onclick={() => chatState.handleSearchInputStateChange(!chatState.isSearchInput)}
				>
					<ScanSearch
						class={cn("size-5", chatState.isSearchInput && "!text-icon-btn-active-fg")}
					/>
				</ButtonWithTooltip>

				{#if chatState.isSearchInput}
					<div
						bind:this={searchPanelRef}
						class="absolute top-full mt-1 flex h-9 items-center gap-1 rounded-md border border-input bg-background px-2 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200"
						style={`right: ${searchPanelRightOffset}px;`}
					>
						<Search class="text-foreground/70 size-4 shrink-0" />
						<input
							bind:this={searchInputRef}
							bind:value={searchInputValue}
							type="text"
							placeholder={m.tooltip_search_content()}
							class="h-7 w-32 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
							onkeydown={handleSearchInputKeydown}
						/>
						<button
							class={cn(
								"flex size-5 cursor-pointer items-center justify-center rounded transition-colors",
								caseSensitive
									? "bg-icon-btn-active text-icon-btn-active-fg"
									: "text-foreground/70 hover:bg-icon-btn-hover",
							)}
							title={m.search_case_sensitive()}
							onclick={toggleCaseSensitive}
						>
							<CaseSensitive class="size-3.5" />
						</button>
						<button
							class={cn(
								"flex size-5 cursor-pointer items-center justify-center rounded transition-colors",
								wholeWord
									? "bg-icon-btn-active text-icon-btn-active-fg"
									: "text-foreground/70 hover:bg-icon-btn-hover",
							)}
							title={m.search_whole_word()}
							onclick={toggleWholeWord}
						>
							<WholeWord class="size-3.5" />
						</button>
						<button
							class={cn(
								"flex size-5 cursor-pointer items-center justify-center rounded transition-colors",
								useRegex
									? "bg-icon-btn-active text-icon-btn-active-fg"
									: "text-foreground/70 hover:bg-icon-btn-hover",
							)}
							title={m.search_regex()}
							onclick={toggleRegex}
						>
							<Code class="size-3.5" />
						</button>
						<span
							class="flex items-center gap-0.5 text-xs text-foreground tabular-nums"
						>
							<span
								class="min-w-[2.5rem] text-center w-14 py-0 px-[2px] whitespace-nowrap box-content"
							>
								{#if searchInputValue && totalMatches > 0}
									{currentMatchIndex}/{totalMatches}
								{:else}
									{m.search_no_results()}
								{/if}
							</span>
							<button
								class="cursor-pointer text-foreground/70 hover:bg-icon-btn-hover hover:text-foreground flex items-center justify-center rounded p-0.5 transition-colors disabled:opacity-50"
								onclick={handlePrevMatch}
								disabled={totalMatches === 0}
							>
								<ChevronUp class="size-3.5" />
							</button>
							<button
								class="cursor-pointer text-foreground/70 hover:bg-icon-btn-hover hover:text-foreground flex items-center justify-center rounded p-0.5 transition-colors disabled:opacity-50"
								onclick={handleNextMatch}
								disabled={totalMatches === 0}
							>
								<ChevronDown class="size-3.5" />
							</button>
						</span>
						<button
							class="cursor-pointer text-foreground/70 hover:text-foreground hover:bg-icon-btn-hover flex size-5 items-center justify-center rounded transition-colors"
							onclick={handleClearSearch}
						>
							<X class="size-3" />
						</button>
					</div>
				{/if}
			{/if}
		</div>

		<ButtonWithTooltip
			class={cn(
				"hover:!bg-icon-btn-hover",
				chatState.isPrivateChatActive && "!bg-icon-btn-active hover:!bg-icon-btn-active",
			)}
			tooltipSide="bottom"
			tooltip={chatState.canTogglePrivacy
				? m.title_incognito()
				: m.title_incognito_disabled()}
			disabled={!chatState.canTogglePrivacy}
			onclick={() => chatState.handlePrivateChatActiveChange(!chatState.isPrivateChatActive)}
		>
			<Ghost
				class={cn("size-5", chatState.isPrivateChatActive && "!text-icon-btn-active-fg")}
			/>
		</ButtonWithTooltip>

		<ButtonWithTooltip
			tooltip={m.title_help_docs()}
			class="hover:!bg-icon-btn-hover"
			tooltipSide="bottom"
			onclick={() => handleOpenHelpDocs()}
		>
			<MessageCircleQuestionMark class="size-5" />
		</ButtonWithTooltip>

		<ButtonWithTooltip
			tooltip={m.title_settings()}
			class="hover:!bg-icon-btn-hover"
			tooltipSide="bottom"
			onclick={() => handleNewSettingsTab()}
		>
			<Settings class="size-5" />
		</ButtonWithTooltip>
	</div>
</div>
