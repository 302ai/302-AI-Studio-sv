<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { SettingInputField, SettingSwitchItem } from "$lib/components/buss/settings";
	import { m } from "$lib/paraglide/messages.js";
	import { generalSettings } from "$lib/stores/general-settings.state.svelte";
	import type { ProxySettings } from "@shared/storage/general-settings";
	import { toast } from "svelte-sonner";

	// Local state for form inputs
	let proxyEnabled = $state(generalSettings.proxyEnabled);
	let proxyHost = $state(generalSettings.proxy.host);
	let proxyPort = $state(generalSettings.proxy.port);
	let isTesting = $state(false);
	let testResult = $state<{ success: boolean; message: string } | null>(null);
	let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Validation
	function validateHost(host: string): boolean {
		if (!host || host.trim() === "") return false;
		// Simple validation: allow IP addresses or domain names
		const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
		const domainPattern =
			/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
		return ipPattern.test(host.trim()) || domainPattern.test(host.trim());
	}

	function validatePort(port: number): boolean {
		return port >= 1 && port <= 65535;
	}

	// Auto-save with debounce
	function autoSave() {
		// Clear previous timer
		if (saveDebounceTimer) {
			clearTimeout(saveDebounceTimer);
		}

		// Set new debounce timer (1000ms)
		saveDebounceTimer = setTimeout(() => {
			// Validate inputs if proxy is enabled
			if (proxyEnabled) {
				if (!validateHost(proxyHost)) {
					toast.warning(m.proxy_invalid_host());
				}
				if (!validatePort(proxyPort)) {
					toast.warning(m.proxy_invalid_port());
				}
			}

			// Save settings even if validation fails (with warning)
			const proxySettings: ProxySettings = {
				enabled: proxyEnabled,
				host: proxyHost.trim(),
				port: proxyPort,
			};

			generalSettings.setProxy(proxySettings);
			// Silent save - no success toast
			testResult = null; // Clear test result when settings change

			saveDebounceTimer = null;
		}, 1000);
	}

	// Test proxy connection
	async function handleTest() {
		if (!validateHost(proxyHost)) {
			toast.error(m.proxy_invalid_host());
			return;
		}
		if (!validatePort(proxyPort)) {
			toast.error(m.proxy_invalid_port());
			return;
		}

		// Save settings before testing
		if (saveDebounceTimer) {
			clearTimeout(saveDebounceTimer);
			saveDebounceTimer = null;
		}

		const proxySettings: ProxySettings = {
			enabled: true, // Force enable for testing
			host: proxyHost.trim(),
			port: proxyPort,
		};

		generalSettings.setProxy(proxySettings);

		isTesting = true;
		testResult = null;

		try {
			const result =
				await window.electronAPI.generalSettingsService.testProxyConnection(proxySettings);

			if (result.success) {
				testResult = { success: true, message: m.proxy_test_success() };
				toast.success(m.proxy_test_success());
			} else {
				testResult = {
					success: false,
					message: `${m.proxy_test_failed()}: ${result.error || "Unknown error"}`,
				};
				toast.error(testResult.message);
			}
		} catch (error) {
			testResult = {
				success: false,
				message: `${m.proxy_test_failed()}: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
			toast.error(testResult.message);
		} finally {
			isTesting = false;
		}
	}
</script>

<div class="flex flex-col gap-settings-section-gap pb-settings-layout-pb">
	<!-- Enable Proxy Switch -->
	<div class="gap-settings-gap flex flex-col">
		<Label id="proxy-enable" class="text-label-fg">{m.proxy_settings()}</Label>
		<SettingSwitchItem
			label={m.proxy_enable()}
			checked={proxyEnabled}
			onCheckedChange={(v) => {
				proxyEnabled = v;
				autoSave();
			}}
		/>
	</div>

	<!-- Proxy Host -->
	<SettingInputField
		label={m.proxy_host()}
		id="proxy-host"
		type="text"
		placeholder={m.proxy_host_placeholder()}
		bind:value={proxyHost}
		disabled={!proxyEnabled}
		oninput={autoSave}
	/>

	<!-- Proxy Port -->
	<SettingInputField
		label={m.proxy_port()}
		id="proxy-port"
		type="number"
		placeholder={m.proxy_port_placeholder()}
		bind:value={proxyPort}
		disabled={!proxyEnabled}
		oninput={autoSave}
	/>

	<!-- Action Buttons -->
	<div class="flex gap-2">
		<Button onclick={handleTest} disabled={!proxyEnabled || isTesting} variant="outline">
			{isTesting ? m.proxy_testing() : m.proxy_test()}
		</Button>
	</div>

	<!-- Test Result Display -->
	{#if testResult}
		<div
			class="rounded-md border p-3 text-sm {testResult.success
				? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
				: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'}"
		>
			{testResult.message}
		</div>
	{/if}
</div>
