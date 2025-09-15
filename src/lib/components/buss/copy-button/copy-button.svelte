<script lang="ts" module>
	interface Props {
		content: string;
		position?: "bottom" | "right" | "top" | "left";
	}
</script>

<script lang="ts">
	import { m } from "$lib/paraglide/messages.js";
	import { cn } from "$lib/utils.js";
	import { Check, Copy } from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import { ButtonWithTooltip } from "../button-with-tooltip";

	let { content, position = "bottom" }: Props = $props();

	let isCopied = $state(false);
	let timeoutId: NodeJS.Timeout | null = null;

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(content);
			toast.success(m.toast_copied_success());

			isCopied = true;
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			timeoutId = setTimeout(() => {
				isCopied = false;
			}, 2000);
		} catch {
			toast.error(m.toast_copied_failed());
		}
	}
</script>

<ButtonWithTooltip
	class="relative text-muted-foreground hover:!bg-chat-action-hover"
	tooltip={m.title_copy()}
	onclick={handleCopy}
	tooltipSide={position}
>
	{#each [{ Icon: Check, visible: isCopied, key: "check" }, { Icon: Copy, visible: !isCopied, key: "copy" }] as { Icon, visible, key } (key)}
		<Icon
			class={cn(
				"absolute inset-0 m-auto transition-all duration-200 ease-in-out",
				visible ? "scale-100 opacity-100" : "scale-0 opacity-0",
			)}
		/>
	{/each}
</ButtonWithTooltip>
