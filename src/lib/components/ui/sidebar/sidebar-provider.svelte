<script lang="ts">
	import * as Tooltip from "$lib/components/ui/tooltip/index.js";
	import { cn, type WithElementRef } from "$lib/utils.js";
	import { onMount } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import {
		SIDEBAR_COOKIE_MAX_AGE,
		SIDEBAR_COOKIE_NAME,
		SIDEBAR_WIDTH,
		SIDEBAR_WIDTH_ICON,
	} from "./constants.js";
	import { setSidebar } from "./context.svelte.js";

	let {
		ref = $bindable(null),
		open = $bindable(true),
		onOpenChange = () => {},
		class: className,
		style,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	} = $props();

	let isBroadcastUpdate = $state(false);
	let isInitializing = $state(true);

	const readSidebarStateFromCookie = (): boolean => {
		if (typeof document === "undefined") return open;
		const cookieValue = document.cookie
			.split("; ")
			.find((row) => row.startsWith(`${SIDEBAR_COOKIE_NAME}=`));
		if (cookieValue) {
			return cookieValue.split("=")[1] === "true";
		}
		return open;
	};

	// Initialize open state from cookie
	open = readSidebarStateFromCookie();

	// Mark initialization complete after compositor settles
	onMount(() => {
		setTimeout(() => {
			isInitializing = false;
		}, 100);
	});

	const sidebar = setSidebar({
		open: () => open,
		setOpen: (value: boolean) => {
			open = value;
			onOpenChange(value);
			document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;

			// Broadcast state change to other tabs
			if (typeof window !== "undefined" && window.electronAPI?.broadcastService) {
				window.electronAPI.broadcastService.broadcastExcludeSource("sidebar-state-changed", {
					open: value,
				});
			}
		},
		isBroadcastUpdate: () => isBroadcastUpdate,
		isInitializing: () => isInitializing,
	});

	// Listen for sidebar state changes from other tabs
	onMount(() => {
		if (typeof window !== "undefined" && window.electronAPI?.onSidebarStateChanged) {
			const cleanup = window.electronAPI.onSidebarStateChanged((data) => {
				// Disable transitions during broadcast update
				isBroadcastUpdate = true;

				// Synchronously update all state
				open = data.open;
				onOpenChange(data.open);
				document.cookie = `${SIDEBAR_COOKIE_NAME}=${data.open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;

				// Re-enable transitions after DOM update
				requestAnimationFrame(() => {
					isBroadcastUpdate = false;
				});
			});

			return cleanup;
		}
	});
</script>

<svelte:window onkeydown={sidebar.handleShortcutKeydown} />

<Tooltip.Provider delayDuration={0}>
	<div
		data-slot="sidebar-wrapper"
		style="--sidebar-width: {SIDEBAR_WIDTH}; --sidebar-width-icon: {SIDEBAR_WIDTH_ICON}; {style}"
		class={cn(
			"group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full",
			className,
		)}
		bind:this={ref}
		{...restProps}
	>
		{@render children?.()}
	</div>
</Tooltip.Provider>
