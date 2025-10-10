<script lang="ts">
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import type { ChatMessage } from "$lib/types/chat";
	import { generalSettings } from "$lib/stores/general-settings.state.svelte";
	import { cn } from "$lib/utils";
	import AssistantMessage from "./assistant-message.svelte";
	import UserMessage from "./user-message.svelte";

	interface Props {
		messages: ChatMessage[];
	}

	let { messages }: Props = $props();
	let scrollAreaRef: HTMLElement | null = $state(null);

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
</script>

<ScrollArea bind:ref={scrollAreaRef} class="h-full w-full">
	<div class="flex w-full justify-center">
		<div class={cn("w-full space-y-4 py-8", containerClass)}>
			{#each messages as message (message.id)}
				{#if message.role === "user"}
					<UserMessage message={{ ...message, role: "user" as const, attachments: [] }} />
				{:else if message.role === "assistant"}
					<AssistantMessage message={{ ...message, role: "assistant" as const }} />
				{/if}
			{/each}
		</div>
	</div>
</ScrollArea>
