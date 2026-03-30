<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { devLauncherState } from "$lib/stores/code-agent/dev-launcher-state.svelte";
	import { LoaderCircle } from "@lucide/svelte";

	let { visible }: { visible: boolean } = $props();

	let imageAddress = $state("ghcr.io/302ai/cc-local-api:oc");
</script>

{#if visible}
	<div class="mt-4 rounded-md bg-primary/10 border-2 border-dashed border-primary/60 p-4">
		<Label class="mb-2 block text-sm font-semibold text-primary">🛠 Dev Sandbox Launcher</Label>

		<div class="flex items-center gap-2">
			<Input
				bind:value={imageAddress}
				placeholder="ghcr.io/302ai/cc-local-api:oc"
				class="flex-1 text-sm border-primary/50"
				disabled={devLauncherState.isLaunching || devLauncherState.isRunning}
			/>
		</div>

		<div class="mt-3 flex items-center gap-2">
			{#if devLauncherState.isRunning}
				<Button size="sm" variant="destructive" onclick={() => devLauncherState.stop()}>
					Stop
				</Button>
			{:else}
				<Button
					size="sm"
					variant="default"
					onclick={() => devLauncherState.launch(imageAddress, "podman")}
					disabled={devLauncherState.isLaunching || !imageAddress.trim()}
				>
					{#if devLauncherState.isLaunching}
						<LoaderCircle class="mr-1 h-4 w-4 animate-spin" />
					{/if}
					Podman Launch
				</Button>
				<Button
					size="sm"
					variant="secondary"
					onclick={() => devLauncherState.launch(imageAddress, "docker")}
					disabled={devLauncherState.isLaunching || !imageAddress.trim()}
				>
					{#if devLauncherState.isLaunching}
						<LoaderCircle class="mr-1 h-4 w-4 animate-spin" />
					{/if}
					Docker Desktop Launch
				</Button>
			{/if}
		</div>

		{#if devLauncherState.error}
			<p class="mt-2 text-sm text-red-500">{devLauncherState.error}</p>
		{/if}
	</div>
{/if}
