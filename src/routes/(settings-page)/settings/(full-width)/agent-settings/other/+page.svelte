<script lang="ts">
	import { SettingSwitchItem } from "$lib/components/buss/settings";
	import { m } from "$lib/paraglide/messages";
	import { codeAgentGlobalConfigsState } from "$lib/stores/code-agent";
	import DeployedWebsitesList from "../deployed-websites-list.svelte";
</script>

<div class="mx-auto flex flex-col h-full gap-6 max-w-settings-layout m-auto">
	<div class="space-y-2">
		<h2 class="text-sm text-label-fg">{m.agent_settings_notifications_section()}</h2>
		<SettingSwitchItem
			label={m.settings_notificationsEnabled()}
			checked={codeAgentGlobalConfigsState.notificationsEnabled}
			onCheckedChange={() => codeAgentGlobalConfigsState.toggleNotificationsEnabled()}
		/>
	</div>
	<div class="space-y-2 h-full">
		<h2 class="text-sm text-label-fg">{m.agent_settings_deploy_section()}</h2>
		<SettingSwitchItem
			label={m.auto_deploy()}
			checked={codeAgentGlobalConfigsState.autoDeploy}
			onCheckedChange={() => codeAgentGlobalConfigsState.toggleAutoDeploy()}
		/>
		<SettingSwitchItem
			label={m.auto_fix_deploy_failure()}
			checked={codeAgentGlobalConfigsState.autoFixDeployFailure}
			onCheckedChange={() => codeAgentGlobalConfigsState.toggleAutoFixDeployFailure()}
		/>
		<DeployedWebsitesList />
	</div>
</div>
