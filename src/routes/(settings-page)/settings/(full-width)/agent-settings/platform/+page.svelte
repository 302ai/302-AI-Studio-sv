<script lang="ts">
	import { SegButton } from "$lib/components/buss/settings";
	import { m } from "$lib/paraglide/messages";
	import CloudPlatform from "../cloud-platform.svelte";
	import LocalPlatform from "../local-platform.svelte";
	import RemotePlatform from "../remote-platform.svelte";

	const platformOptions = [
		{
			key: "remote",
			label: m.platform_remote_label(),
			description: m.platform_remote_description(),
		},
		{
			key: "cloud",
			label: m.platform_cloud_label(),
			description: m.platform_cloud_description(),
		},
		{
			key: "local",
			label: m.platform_local_label(),
			description: m.platform_local_description(),
		},
	];
	type PlatformKey = (typeof platformOptions)[number]["key"];

	const url = new URL(window.location.href);
	const queryPlatform = url.searchParams.get("platform") as PlatformKey | null;

	let selectedPlatform = $state<PlatformKey>(queryPlatform || "remote");

	function handlePlatformSelect(key: PlatformKey) {
		selectedPlatform = key;
	}
</script>

<div class="mx-auto flex flex-col h-full w-full max-w-3xl gap-6">
	<!-- Platform Section -->
	<div class="sticky top-0 w-full bg-background z-50">
		<SegButton
			options={platformOptions}
			selectedKey={selectedPlatform}
			onSelect={handlePlatformSelect}
			class="!h-[52px] shrink-0"
			thumbClass="!h-[40px]"
		/>
	</div>

	<div class="grow max-w-settings-layout m-auto w-full">
		{#if selectedPlatform === "remote"}
			<RemotePlatform />
		{:else if selectedPlatform === "cloud"}
			<CloudPlatform />
		{:else if selectedPlatform === "local"}
			<LocalPlatform />
		{/if}
	</div>
</div>
