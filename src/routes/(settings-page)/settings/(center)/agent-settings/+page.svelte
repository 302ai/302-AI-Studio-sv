<script lang="ts">
	import { SettingSwitchItem } from "$lib/components/buss/settings";
	import SegButton from "$lib/components/buss/settings/seg-button.svelte";
	import { m } from "$lib/paraglide/messages";
	import { codeAgentGlobalConfigsState } from "$lib/stores/code-agent/code-agent-global-configs-state.svelte";
	import LocalPlatform from "./local-platform.svelte";
	import RemotePlatform from "./remote-platform.svelte";

	import DeployedWebsitesList from "./deployed-websites-list.svelte";

	const platformOptions = [
		{
			key: "remote",
			label: m.title_remote(),
			description: m.title_remote_platform_description(),
		},
		{
			key: "local",
			label: m.title_local(),
			description: m.title_local_platform_description(),
		},
	];

	let selectedPlatform = $state("remote");

	function handlePlatformSelect(key: string) {
		selectedPlatform = key;
	}
</script>

<div class="mx-auto flex h-full w-full max-w-3xl flex-col gap-6">
	<SettingSwitchItem
		label={m.auto_deploy()}
		checked={codeAgentGlobalConfigsState.autoDeploy}
		onCheckedChange={() => codeAgentGlobalConfigsState.toggleAutoDeploy()}
	/>
	<SettingSwitchItem
		label={m.settings_notificationsEnabled()}
		checked={codeAgentGlobalConfigsState.notificationsEnabled}
		onCheckedChange={() => codeAgentGlobalConfigsState.toggleNotificationsEnabled()}
	/>
	<DeployedWebsitesList />

	<!-- Platform Section -->
	<div class="space-y-2">
		<h2 class="text-sm text-label-fg">{m.title_agent_platform()}</h2>
		<SegButton
			options={platformOptions}
			selectedKey={selectedPlatform}
			onSelect={handlePlatformSelect}
			class="!h-[52px]"
			thumbClass="!h-[40px]"
		/>
	</div>

	{#if selectedPlatform === "remote"}
		<RemotePlatform />
	{:else if selectedPlatform === "local"}
		<LocalPlatform />
	{/if}
</div>
