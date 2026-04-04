<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { m } from "$lib/paraglide/messages.js";
	import { cn } from "$lib/utils";
	import {
		Copy,
		Loader2,
		Monitor,
		Pin,
		PinOff,
		Rocket,
		RotateCw,
		Smartphone,
		SquareArrowOutUpRight,
		X,
	} from "@lucide/svelte";

	export type PreviewTab = {
		id: string;
		label: string;
	};

	interface Props {
		activeTab: string;
		tabs: PreviewTab[];
		deviceMode: "desktop" | "mobile";
		isDeploying: boolean;
		deployedUrl: string | null;
		compactDeployButton?: boolean;
		isPinned: boolean;
		isStreaming?: boolean;
		onTabChange: (tab: string) => void;
		onDeviceModeChange: (mode: "desktop" | "mobile") => void;
		onDeploy: () => void;
		onClose: () => void;
		onOpenDeployedUrl: () => void;
		onOpenInNewTab: () => void;
		onCopyDeployedUrl: () => void;
		onRefreshPreview?: () => void;
		onPin: () => void;
		isAgentMode?: boolean;
		isDeleted?: boolean;
	}

	let {
		activeTab,
		tabs,
		deviceMode,
		isDeploying,
		deployedUrl,
		compactDeployButton = false,
		isPinned,
		isStreaming = false,
		onTabChange,
		onDeviceModeChange,
		onDeploy,
		onClose,
		onOpenDeployedUrl,
		onOpenInNewTab,
		onCopyDeployedUrl,
		onRefreshPreview,
		onPin,
		isAgentMode = false,
		isDeleted = false,
	}: Props = $props();
</script>

<div
	class="shrink-0 border-b border-border bg-background w-full min-w-0"
	style="container-type: inline-size;"
>
	<!-- 顶部 A：Tab 切换和关闭按钮 -->
	<div
		class="flex h-10 w-full items-center justify-between min-w-0 gap-2 px-2 [@container(max-width:349px)]:gap-1 [@container(max-width:349px)]:px-1"
	>
		<!-- 左侧：Tabs -->
		<div
			class="flex flex-row items-center gap-0.5 rounded-md bg-muted p-0.5 overflow-x-auto shrink min-w-0 scrollbar-none"
		>
			{#each tabs as tab (tab.id)}
				<button
					type="button"
					class={cn(
						"text-xs font-medium transition-colors rounded whitespace-nowrap px-2.5 py-0.5 [@container(max-width:349px)]:px-1.5 cursor-pointer shrink-0",
						activeTab === tab.id
							? "bg-primary text-primary-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground",
					)}
					onclick={() => onTabChange(tab.id)}
				>
					{tab.label}
				</button>
			{/each}
		</div>

		<!-- 右侧：按钮组 -->
		<div class="flex items-center gap-1 shrink-0">
			{#if activeTab === "preview" || activeTab === "openclaw-webui"}
				<ButtonWithTooltip
					tooltip={m.label_button_open_in_new_tab()}
					class="hover:!bg-icon-btn-hover size-8"
					tooltipSide="bottom"
					onclick={onOpenInNewTab}
				>
					<SquareArrowOutUpRight class="size-4" />
				</ButtonWithTooltip>
			{/if}
			<ButtonWithTooltip
				tooltip={isPinned ? m.tooltip_unpin_panel() : m.tooltip_pin_panel()}
				class="hover:!bg-icon-btn-hover size-8"
				tooltipSide="bottom"
				onclick={onPin}
			>
				{#if isPinned}
					<Pin class="size-4" style="color: #8E47F0;" />
				{:else}
					<PinOff class="size-4" />
				{/if}
			</ButtonWithTooltip>
			<ButtonWithTooltip
				tooltip={m.label_button_close()}
				class="hover:!bg-icon-btn-hover size-8"
				tooltipSide="bottom"
				onclick={onClose}
			>
				<X class="size-4" />
			</ButtonWithTooltip>
		</div>
	</div>

	<!-- 分隔区域 -->
	<div class="w-full h-2 bg-[#F2F3F5] dark:bg-[#1a1a1a]"></div>

	<!-- 顶部 B：部署和设备切换 -->
	{#if activeTab === "preview"}
		<div
			class="grid h-10 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 min-w-0"
		>
			<!-- 左侧：部署按钮 -->
			<div class="flex items-center gap-1 min-w-0">
				{#if (!deployedUrl && !compactDeployButton && !isDeleted) || (isAgentMode && !isDeleted)}
					<button
						type="button"
						class="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border/40 bg-background text-foreground text-xs font-medium shadow-none transition-colors hover:bg-muted/70 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
						title={isDeploying ? m.tooltip_deploying() : m.tooltip_deploy_to_302()}
						disabled={isDeploying || isStreaming}
						onclick={onDeploy}
					>
						{#if isDeploying}
							<Loader2 class="size-4 shrink-0 animate-spin" />
						{:else}
							<Rocket class="size-4 shrink-0" />
						{/if}
						<span class="shrink-0">{m.text_button_deploy()}</span>
					</button>
				{:else if !isDeleted}
					<ButtonWithTooltip
						tooltip={isDeploying ? m.tooltip_deploying() : m.tooltip_deploy_to_302()}
						class="hover:!bg-icon-btn-hover shrink-0"
						tooltipSide="bottom"
						disabled={isDeploying || isStreaming}
						onclick={onDeploy}
					>
						{#if isDeploying}
							<Loader2 class="size-4 animate-spin" />
						{:else}
							<Rocket class="size-4" />
						{/if}
					</ButtonWithTooltip>
				{/if}

				{#if deployedUrl}
					<button
						type="button"
						class="flex flex-1 items-center gap-1 overflow-hidden rounded border border-border/40 bg-background px-2 py-1 text-xs text-primary shadow-none transition-colors hover:bg-muted/70 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 min-w-[28px] max-w-[200px] cursor-pointer"
						title={deployedUrl ?? undefined}
						onclick={onOpenDeployedUrl}
					>
						<SquareArrowOutUpRight class="size-3 shrink-0" />
						<span class="truncate text-left whitespace-nowrap">{deployedUrl}</span>
					</button>

					<ButtonWithTooltip
						tooltip={m.tooltip_copy_deploy_url()}
						class="hover:!bg-icon-btn-hover shrink-0"
						tooltipSide="bottom"
						onclick={onCopyDeployedUrl}
						size="icon-sm"
					>
						<Copy class="size-4" />
					</ButtonWithTooltip>
				{/if}

				{#if onRefreshPreview}
					<ButtonWithTooltip
						tooltip={m.label_button_reload()}
						class="hover:!bg-icon-btn-hover shrink-0"
						tooltipSide="bottom"
						onclick={onRefreshPreview}
						size="icon-sm"
					>
						<RotateCw class="size-4" />
					</ButtonWithTooltip>
				{/if}
			</div>

			<!-- 右侧：设备模式切换 -->
			<div
				class="flex flex-row items-center gap-0.5 rounded-[100px] bg-[#8E47F0] p-0.5 shrink-0 justify-self-end"
			>
				<button
					type="button"
					class={cn(
						"flex items-center justify-center transition-all rounded-[100px] cursor-pointer",
						deviceMode === "desktop"
							? "w-[32px] h-[20px] bg-[#FFFFFF] text-[#8E47F0] shadow-sm"
							: "w-[32px] h-[20px] text-white/70 hover:text-white",
					)}
					onclick={() => onDeviceModeChange("desktop")}
					title={m.tooltip_desktop_view()}
				>
					<Monitor class="size-3.5" />
				</button>
				<button
					type="button"
					class={cn(
						"flex items-center justify-center transition-all rounded-[100px] cursor-pointer",
						deviceMode === "mobile"
							? "w-[32px] h-[20px] bg-[#FFFFFF] text-[#8E47F0] shadow-sm"
							: "w-[32px] h-[20px] text-white/70 hover:text-white",
					)}
					onclick={() => onDeviceModeChange("mobile")}
					title={m.tooltip_mobile_view()}
				>
					<Smartphone class="size-3.5" />
				</button>
			</div>
		</div>
	{/if}
</div>
