<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { m } from "$lib/paraglide/messages.js";
	import { htmlPreviewState } from "$lib/stores/html-preview-state.svelte";
	import { cn } from "$lib/utils";
	import {
		Copy,
		Monitor,
		Pin,
		PinOff,
		Rocket,
		Smartphone,
		SquareArrowOutUpRight,
		X,
	} from "@lucide/svelte";

	interface Props {
		activeTab: "preview" | "code";
		deviceMode: "desktop" | "mobile";
		isDeploying: boolean;
		deployedUrl: string | null;
		onTabChange: (tab: "preview" | "code") => void;
		onDeviceModeChange: (mode: "desktop" | "mobile") => void;
		onDeploy: () => void;
		onClose: () => void;
		onOpenDeployedUrl: () => void;
		onOpenInNewTab: () => void;
		onCopyDeployedUrl: () => void;
	}

	let {
		activeTab,
		deviceMode,
		isDeploying,
		deployedUrl,
		onTabChange,
		onDeviceModeChange,
		onDeploy,
		onClose,
		onOpenDeployedUrl,
		onOpenInNewTab,
		onCopyDeployedUrl,
	}: Props = $props();
</script>

<div class="shrink-0 border-b border-border bg-background w-full min-w-0">
	<!-- 顶部 A：Tab 切换和关闭按钮 -->
	<div
		class="grid h-10 w-full grid-cols-[auto_auto] items-center justify-between gap-2 px-2 min-w-0"
	>
		<!-- 左侧：预览/代码 Tab -->
		<div class="flex flex-row items-center gap-0.5 rounded-md bg-muted p-0.5 shrink-0">
			<button
				type="button"
				class={cn(
					"px-2.5 py-0.5 text-xs font-medium transition-colors rounded",
					activeTab === "preview"
						? "bg-background text-foreground shadow-sm"
						: "text-muted-foreground hover:text-foreground",
				)}
				onclick={() => onTabChange("preview")}
			>
				{m.label_tab_preview()}
			</button>
			<button
				type="button"
				class={cn(
					"px-2.5 py-0.5 text-xs font-medium transition-colors rounded",
					activeTab === "code"
						? "bg-background text-foreground shadow-sm"
						: "text-muted-foreground hover:text-foreground",
				)}
				onclick={() => onTabChange("code")}
			>
				{m.label_tab_code()}
			</button>
		</div>

		<!-- 右侧：按钮组 -->
		<div class="flex items-center gap-1 shrink-0 justify-self-end">
			<!-- {#if isAgentMode}
				<span
					class="px-2 py-1 text-[11px] font-medium rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
				>
					{m.label_agent_mode_badge()}
				</span>
			{:else}
				<button
					type="button"
					class="px-2.5 py-1 text-[11px] font-medium rounded-md border border-border bg-muted/70 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
					onclick={onEnableAgentMode}
				>
					{m.label_button_enable_agent_mode()}
				</button>
			{/if} -->
			<ButtonWithTooltip
				tooltip={m.label_button_open_in_new_tab()}
				class="hover:!bg-icon-btn-hover size-8"
				tooltipSide="bottom"
				onclick={onOpenInNewTab}
			>
				<SquareArrowOutUpRight class="size-4" />
			</ButtonWithTooltip>
			<ButtonWithTooltip
				tooltip={htmlPreviewState.isPinned ? m.tooltip_unpin_panel() : m.tooltip_pin_panel()}
				class="hover:!bg-icon-btn-hover size-8"
				tooltipSide="bottom"
				onclick={() => htmlPreviewState.togglePin()}
			>
				{#if htmlPreviewState.isPinned}
					<Pin class="size-4" />
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
	<div class="grid h-10 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 min-w-0">
		<!-- 左侧：部署按钮 -->
		<div class="flex items-center gap-2 min-w-0">
			{#if deployedUrl}
				<div class="flex-1 min-w-0 max-w-[200px]">
					<button
						type="button"
						class="flex w-full min-w-0 items-center gap-1 overflow-hidden rounded border border-border/40 bg-background px-2 py-1 text-xs text-primary shadow-none transition-colors hover:bg-muted/70 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						title={deployedUrl ?? undefined}
						onclick={onOpenDeployedUrl}
					>
						<SquareArrowOutUpRight class="size-3 shrink-0" />
						<span class="truncate flex-1 min-w-0 text-left">{deployedUrl}</span>
					</button>
				</div>
				<ButtonWithTooltip
					tooltip={m.tooltip_copy_deploy_url()}
					class="hover:!bg-icon-btn-hover shrink-0"
					tooltipSide="bottom"
					onclick={onCopyDeployedUrl}
				>
					<Copy class="size-4" />
				</ButtonWithTooltip>
			{:else}
				<ButtonWithTooltip
					tooltip={isDeploying ? m.tooltip_deploying() : m.tooltip_deploy_to_302()}
					class="hover:!bg-icon-btn-hover shrink-0"
					tooltipSide="bottom"
					disabled={isDeploying}
					onclick={onDeploy}
				>
					<Rocket class="size-4" />
				</ButtonWithTooltip>
			{/if}
		</div>

		<!-- 右侧：设备模式切换（仅预览模式显示） -->
		{#if activeTab === "preview"}
			<div
				class="flex flex-row items-center gap-0.5 rounded-md bg-muted p-0.5 shrink-0 justify-self-end"
			>
				<button
					type="button"
					class={cn(
						"p-1.5 transition-colors rounded",
						deviceMode === "desktop"
							? "bg-background text-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground",
					)}
					onclick={() => onDeviceModeChange("desktop")}
					title={m.tooltip_desktop_view()}
				>
					<Monitor class="size-4" />
				</button>
				<button
					type="button"
					class={cn(
						"p-1.5 transition-colors rounded",
						deviceMode === "mobile"
							? "bg-background text-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground",
					)}
					onclick={() => onDeviceModeChange("mobile")}
					title={m.tooltip_mobile_view()}
				>
					<Smartphone class="size-4" />
				</button>
			</div>
		{/if}
	</div>
</div>
