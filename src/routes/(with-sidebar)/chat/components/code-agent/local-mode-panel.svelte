<script lang="ts" module>
	export interface Props {
		onClose?: () => void;
	}
</script>

<script lang="ts">
	import AgentWorkspaceConfig from "$lib/components/buss/local-agent-panel/agent-workspace-config.svelte";
	import PodmanCard from "$lib/components/buss/local-agent-panel/podman-card.svelte";
	import SandboxCard from "$lib/components/buss/local-agent-panel/sandbox-card.svelte";
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
	import { onMount } from "svelte";

	let { onClose }: Props = $props();

	onMount(() => {
		codeAgentState.init();
	});

	async function handleInstall() {
		await localEnvState.installPodman();
	}

	function handleLocalModeConfirm() {
		codeAgentState.handleConfirmEnabled();
		onClose?.();
	}
</script>

<div class="gap-settings-gap flex flex-col">
	<!-- Section 1: Environment Monitoring -->
	<section class="space-y-4">
		<Label class="text-label-fg font-normal">{m.local_platform_environment_monitoring()}</Label>

		<!-- Environment Cards Container -->
		<div class="rounded-lg border p-4 space-y-4">
			<PodmanCard isOpen={false} onInstall={handleInstall} />
			<SandboxCard isOpen={false} />
		</div>
	</section>

	<!-- Section 2: Agent Framework -->
	<section class="space-y-4 mt-2">
		<AgentWorkspaceConfig />
	</section>

	<!-- Footer with Cancel/Confirm buttons -->
	<div class="flex flex-row justify-between">
		<Button variant="secondary" onclick={onClose}>
			{m.common_cancel()}
		</Button>
		<Button onclick={handleLocalModeConfirm}>
			{m.label_button_confirm()}
		</Button>
	</div>
</div>
