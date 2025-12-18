<script lang="ts">
	import { SsoLogoutDialog, type SsoLogoutOptions } from "$lib/components/buss/sso-logout-dialog";
	import * as Avatar from "$lib/components/ui/avatar";
	import { Badge } from "$lib/components/ui/badge";
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { userState } from "$lib/stores/user-state.svelte";
	import { cn } from "$lib/utils.js";
	import { Check, Copy, ExternalLink, RefreshCw } from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import SettingInfoItem from "./setting-info-item.svelte";

	let isRefreshing = $state(false);
	let copiedField = $state<string | null>(null);
	let copyTimeoutId: NodeJS.Timeout | null = null;
	let showLogoutDialog = $state(false);

	function handleLogoutClick() {
		showLogoutDialog = true;
	}

	async function handleLogoutConfirm(options: SsoLogoutOptions) {
		showLogoutDialog = false;
		await userState.logoutWithCleanup(options);
	}

	function handleLogoutClose() {
		showLogoutDialog = false;
	}

	async function handleRefresh() {
		isRefreshing = true;
		try {
			const res = await userState.fetchUserInfo();
			if (res.success) {
				toast.success(m.login_success());
			} else {
				toast.error(res.error || "Failed to refresh");
			}
		} catch (_e) {
			toast.error(m.network_error());
		} finally {
			isRefreshing = false;
		}
	}

	async function copyToClipboard(text: string, field: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(m.toast_copied_success());

			copiedField = field;
			if (copyTimeoutId) {
				clearTimeout(copyTimeoutId);
			}
			copyTimeoutId = setTimeout(() => {
				copiedField = null;
			}, 2000);
		} catch {
			toast.error(m.toast_copied_failed());
		}
	}

	// Helper to format currency
	function formatCurrency(val: number) {
		return val.toFixed(2);
	}

	function openWallet() {
		if (typeof window !== "undefined" && window.electronAPI?.externalLinkService) {
			window.electronAPI.externalLinkService.openExternalLink("https://302.ai/charge");
		}
	}
</script>

{#if userState.isLoggedIn && userState.userInfo}
	<!-- User Info Section -->
	<div class="gap-settings-gap flex flex-col">
		<Label class="text-label-fg font-normal">{m.settings_user_info_label()}</Label>
		<div
			class="rounded-settings-item bg-settings-item-bg px-settings-item-x py-settings-item-y flex w-full items-center gap-4"
		>
			<!-- Avatar -->
			<Avatar.Root class="size-12 shrink-0">
				<Avatar.Image src={userState.userInfo.avatar} alt={userState.userInfo.user_name} />
				<Avatar.Fallback>{userState.userInfo.user_name.slice(0, 2)}</Avatar.Fallback>
			</Avatar.Root>

			<!-- User Details -->
			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-2">
					<div class="text-sm font-semibold truncate">{userState.userInfo.user_name}</div>
					{#if userState.userInfo.is_developer}
						<Badge variant="secondary" class="text-xs shrink-0"
							>{m.settings_developer_badge()}</Badge
						>
					{/if}
				</div>
				<div class="text-sm text-muted-foreground truncate">
					{#if userState.userInfo.email}
						{userState.userInfo.email}
					{:else if userState.userInfo.phone}
						{userState.userInfo.phone}
					{:else}
						UID: {userState.userInfo.uid}
					{/if}
				</div>
			</div>

			<!-- Actions -->
			<div class="flex gap-2 shrink-0">
				<Button
					variant="outline"
					size="icon-sm"
					onclick={handleRefresh}
					disabled={isRefreshing}
					class="dark:hover:bg-muted {isRefreshing ? 'animate-spin' : ''}"
				>
					<RefreshCw class="size-4" />
				</Button>
				<Button variant="outline" size="sm" onclick={handleLogoutClick} class="dark:hover:bg-muted">
					{m.settings_logout()}
				</Button>
			</div>
		</div>
	</div>

	<!-- Account Details Section -->
	<div class="gap-settings-gap flex flex-col">
		<Label class="text-label-fg font-normal">{m.settings_account_details()}</Label>

		{#snippet apiKeyAction()}
			{@const displayApiKey = userState.ssoApiKey || userState.userInfo?.api_key}
			{#if displayApiKey}
				<div class="flex items-center gap-2">
					<code class="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-semibold text-sm">
						{displayApiKey.slice(0, 8)}...
					</code>
					<Button
						variant="ghost"
						size="icon-sm"
						onclick={() => copyToClipboard(displayApiKey, "api_key")}
						class="relative"
					>
						{#each [{ Icon: Check, visible: copiedField === "api_key", id: "check" }, { Icon: Copy, visible: copiedField !== "api_key", id: "copy" }] as { Icon, visible, id } (id)}
							<Icon
								class={cn(
									"absolute inset-0 m-auto size-4 transition-all duration-200 ease-in-out",
									visible ? "scale-100 opacity-100" : "scale-0 opacity-0",
								)}
							/>
						{/each}
					</Button>
				</div>
			{/if}
		{/snippet}
		<SettingInfoItem label={m.settings_api_key()} action={apiKeyAction} />

		{#if userState.userInfo.invite_code}
			{#snippet inviteCodeAction()}
				{#if userState.userInfo}
					<div class="flex items-center gap-2">
						<code
							class="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold"
						>
							{userState.userInfo.invite_code}
						</code>
						<Button
							variant="ghost"
							size="icon-sm"
							onclick={() => copyToClipboard(userState.userInfo!.invite_code, "invite_code")}
							class="relative"
						>
							{#each [{ Icon: Check, visible: copiedField === "invite_code", id: "check" }, { Icon: Copy, visible: copiedField !== "invite_code", id: "copy" }] as { Icon, visible, id } (id)}
								<Icon
									class={cn(
										"absolute inset-0 m-auto size-4 transition-all duration-200 ease-in-out",
										visible ? "scale-100 opacity-100" : "scale-0 opacity-0",
									)}
								/>
							{/each}
						</Button>
					</div>
				{/if}
			{/snippet}
			<SettingInfoItem label={m.settings_invite_code()} action={inviteCodeAction} />
		{/if}
	</div>

	<!-- Balance Section -->
	<div class="gap-settings-gap flex flex-col">
		<div class="flex items-center justify-between">
			<Label class="text-label-fg font-normal">{m.settings_balance_usage()}</Label>
			<Button variant="outline" size="sm" onclick={openWallet} class="dark:hover:bg-muted gap-1.5">
				{m.settings_recharge()}
				<ExternalLink class="size-3.5" />
			</Button>
		</div>

		<SettingInfoItem
			label={m.settings_current_balance()}
			value="${formatCurrency(userState.userInfo.balance)}"
			isBold
		/>
		<SettingInfoItem
			label={m.settings_total_consumed()}
			value="${formatCurrency(userState.userInfo.gpt_cost)}"
			isBold
		/>
		<SettingInfoItem
			label={m.settings_total_requests()}
			value={String(userState.userInfo.gpt_request_times)}
			isBold
		/>
		<SettingInfoItem
			label={m.settings_total_earnings()}
			value="${formatCurrency(userState.userInfo.total_earning)}"
			isBold
		/>
	</div>

	<!-- Logout Dialog -->
	<SsoLogoutDialog
		bind:open={showLogoutDialog}
		userEmail={userState.userInfo?.email || userState.userInfo?.user_name || "User"}
		onConfirm={handleLogoutConfirm}
		onClose={handleLogoutClose}
	/>
{/if}
