<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import StatusIndicator from "$lib/components/buss/local-agent-panel/status-indicator.svelte";

	import {
		createInstance,
		execInstanceCommand,
		getInstanceStatus,
		listInstances,
		readInstanceFiles,
		rebootInstance,
		restartDocker,
		writeInstanceFiles,
	} from "$lib/api/cloud-instance";
	import { Button } from "$lib/components/ui/button";
	import { Card } from "$lib/components/ui/card";
	import { Label } from "$lib/components/ui/label";
	import { Switch } from "$lib/components/ui/switch";
	import { m } from "$lib/paraglide/messages";
	import {
		cloudEnvState,
		type CloudHealthStatus,
	} from "$lib/stores/code-agent/cloud-env-state.svelte";
	import { cn } from "$lib/utils";
	import { LoaderCircle, RefreshCw } from "@lucide/svelte";

	type StatusProps = { status: "green" | "red" | "gray"; text: string };

	function getHealthProps(s: CloudHealthStatus): StatusProps {
		switch (s) {
			case "healthy":
				return { status: "green", text: m.cloud_mode_healthy() };
			case "unhealthy":
				return { status: "red", text: m.cloud_mode_unhealthy() };
			default:
				return { status: "gray", text: m.cloud_mode_unknown() };
		}
	}

	// Start polling on mount, stop on unmount
	$effect(() => {
		cloudEnvState.startPolling();
		return () => cloudEnvState.stopPolling();
	});

	function formatDate(iso?: string): string {
		if (!iso) return "--";
		return new Date(iso).toLocaleDateString();
	}

	// --- Restart / Reboot ---
	let isRestartingDocker = $state(false);
	let isRebooting = $state(false);

	async function handleRestartDockerAction() {
		const instanceName = cloudEnvState.instanceInfo?.instance_name;
		if (!instanceName) return;
		isRestartingDocker = true;
		try {
			await restartDocker({ instance_name: instanceName });
			// Refresh status after restart
			await cloudEnvState.checkStatus();
		} finally {
			isRestartingDocker = false;
		}
	}

	async function handleRebootAction() {
		const instanceName = cloudEnvState.instanceInfo?.instance_name;
		if (!instanceName) return;
		isRebooting = true;
		try {
			await rebootInstance({ instance_name: instanceName });
			// Refresh status after reboot
			await cloudEnvState.checkStatus();
		} finally {
			isRebooting = false;
		}
	}

	// --- Test section ---
	let testLoading = $state(false);
	let testResult = $state<string>("");

	function setResult(data: unknown) {
		testResult = JSON.stringify(data, null, 2);
	}

	function handleError(error: unknown) {
		testResult = `Error: ${error instanceof Error ? error.message : String(error)}`;
	}

	async function handleList() {
		testLoading = true;
		testResult = "";
		try {
			setResult(await listInstances());
		} catch (e) {
			handleError(e);
		} finally {
			testLoading = false;
		}
	}

	async function handleCreate() {
		testLoading = true;
		testResult = "";
		try {
			setResult(await createInstance({ is_dev: true }));
		} catch (e) {
			handleError(e);
		} finally {
			testLoading = false;
		}
	}

	async function handleStatus() {
		testLoading = true;
		testResult = "";
		try {
			const list = await listInstances();
			if (!list.instances?.length) {
				testResult = "No instances found";
				return;
			}
			setResult(await getInstanceStatus(list.instances[0].instance_name));
		} catch (e) {
			handleError(e);
		} finally {
			testLoading = false;
		}
	}

	async function handleRestartDocker() {
		testLoading = true;
		testResult = "";
		try {
			const list = await listInstances();
			if (!list.instances?.length) {
				testResult = "No instances found";
				return;
			}
			setResult(await restartDocker({ instance_name: list.instances[0].instance_name }));
		} catch (e) {
			handleError(e);
		} finally {
			testLoading = false;
		}
	}

	async function handleReboot() {
		testLoading = true;
		testResult = "";
		try {
			const list = await listInstances();
			if (!list.instances?.length) {
				testResult = "No instances found";
				return;
			}
			setResult(await rebootInstance({ instance_name: list.instances[0].instance_name }));
		} catch (e) {
			handleError(e);
		} finally {
			testLoading = false;
		}
	}

	async function handleReadFiles() {
		testLoading = true;
		testResult = "";
		try {
			const list = await listInstances();
			if (!list.instances?.length) {
				testResult = "No instances found";
				return;
			}
			setResult(
				await readInstanceFiles({
					instance_name: list.instances[0].instance_name,
					file_paths: ["/etc/hostname"],
				}),
			);
		} catch (e) {
			handleError(e);
		} finally {
			testLoading = false;
		}
	}

	async function handleWriteFiles() {
		testLoading = true;
		testResult = "";
		try {
			const list = await listInstances();
			if (!list.instances?.length) {
				testResult = "No instances found";
				return;
			}
			setResult(
				await writeInstanceFiles({
					instance_name: list.instances[0].instance_name,
					files: [{ file_path: "/tmp/test.txt", file_content: "hello from 302 studio" }],
				}),
			);
		} catch (e) {
			handleError(e);
		} finally {
			testLoading = false;
		}
	}

	async function handleExec() {
		testLoading = true;
		testResult = "";
		try {
			const list = await listInstances();
			if (!list.instances?.length) {
				testResult = "No instances found";
				return;
			}
			setResult(
				await execInstanceCommand({
					instance_name: list.instances[0].instance_name,
					cmd: "ls /tmp",
				}),
			);
		} catch (e) {
			handleError(e);
		} finally {
			testLoading = false;
		}
	}
</script>

<div class="flex flex-col space-y-6">
	<!-- 环境监测 -->
	<div class="space-y-2">
		<h2 class="text-sm font-medium">{m.local_platform_environment_monitoring()}</h2>
		<div class="rounded-lg border p-5 space-y-5">
			<div class="flex items-start justify-between gap-4">
				<div class="flex-1 space-y-3">
					<div class="flex items-center gap-3">
						<Label class="text-muted-foreground min-w-18 font-normal"
							>{m.agent_settings_instance_status()}</Label
						>
						<StatusIndicator
							status={getHealthProps(cloudEnvState.instanceStatus).status}
							text={getHealthProps(cloudEnvState.instanceStatus).text}
							showWarning={cloudEnvState.instanceStatus === "unhealthy"}
							warningTooltip={m.cloud_mode_try_restart()}
						/>
						{#if cloudEnvState.instanceStatus === "unhealthy" || isRebooting}
							<ButtonWithTooltip
								tooltip={m.cloud_mode_reboot_instance()}
								class="hover:!bg-icon-btn-hover size-8"
								onclick={handleRebootAction}
								disabled={isRebooting}
							>
								<RefreshCw class={cn("h-4 w-4", isRebooting && "animate-spin")} />
							</ButtonWithTooltip>
						{/if}
					</div>
					<div class="flex items-center gap-3">
						<Label class="text-muted-foreground min-w-18 font-normal"
							>{m.cloud_mode_api_status()}</Label
						>
						<StatusIndicator
							status={getHealthProps(cloudEnvState.apiStatus).status}
							text={getHealthProps(cloudEnvState.apiStatus).text}
						/>
					</div>
					<div class="flex items-center gap-3">
						<Label class="text-muted-foreground min-w-18 font-normal"
							>{m.cloud_mode_health_status()}</Label
						>
						<StatusIndicator
							status={getHealthProps(cloudEnvState.healthStatus).status}
							text={getHealthProps(cloudEnvState.healthStatus).text}
						/>
					</div>
					<div class="flex items-center gap-3">
						<Label class="text-muted-foreground min-w-18 font-normal"
							>{m.cloud_mode_openclaw_status()}</Label
						>
						<StatusIndicator
							status={getHealthProps(cloudEnvState.openClawStatus).status}
							text={getHealthProps(cloudEnvState.openClawStatus).text}
							showWarning={cloudEnvState.openClawStatus === "unhealthy"}
							warningTooltip={m.cloud_mode_try_restart()}
						/>
						{#if cloudEnvState.openClawStatus === "unhealthy" || isRestartingDocker}
							<ButtonWithTooltip
								tooltip={m.cloud_mode_restart_docker()}
								class="hover:!bg-icon-btn-hover size-8"
								onclick={handleRestartDockerAction}
								disabled={isRestartingDocker}
							>
								<RefreshCw
									class={cn("h-4 w-4", isRestartingDocker && "animate-spin")}
								/>
							</ButtonWithTooltip>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- 订阅信息 -->
	<div class="space-y-2">
		<h2 class="text-sm font-medium">订阅信息</h2>
		<div class="rounded-lg border p-5 space-y-5">
			<div class="flex justify-between items-center w-full">
				<h3 class="text-base font-semibold">云主机</h3>
				{#if !cloudEnvState.activated}
					<Button
						size="sm"
						disabled={cloudEnvState.starting}
						onclick={() => cloudEnvState.startCloud()}
					>
						{#if cloudEnvState.starting}
							<LoaderCircle class="h-4 w-4 animate-spin" />
						{:else}
							{m.cloud_mode_activate_button()}
						{/if}
					</Button>
				{/if}
			</div>
			<div class="flex justify-between items-end">
				<div class="space-y-1">
					{#if cloudEnvState.instanceInfo}
						<p class="text-sm text-muted-foreground">
							IP：{cloudEnvState.instanceInfo.public_ip || "--"}
						</p>
						<p class="text-sm text-muted-foreground">
							生效日期：{formatDate(cloudEnvState.instanceInfo.created_at)}
						</p>
						<p class="text-sm text-muted-foreground">
							到期日期：{formatDate(cloudEnvState.instanceInfo.expired_at)}
						</p>
					{:else}
						<p class="text-sm text-muted-foreground">暂无实例</p>
					{/if}
				</div>
				{#if !cloudEnvState.activated}
					<div class="flex items-center">
						<Switch
							class="data-[state=unchecked]:border-settings-switch-border cursor-pointer"
						/>
						<span class="text-sm text-muted-foreground ml-2"> 自动续费 </span>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- API Test Section (TODO: remove after testing) -->
	<div class="space-y-2">
		<h2 class="text-sm font-medium">API Test (调试用)</h2>
		<Card class="p-4 space-y-3">
			<div class="flex flex-wrap gap-2">
				<Button size="sm" onclick={handleList} disabled={testLoading}>GET /instances</Button
				>
				<Button size="sm" onclick={handleCreate} disabled={testLoading}
					>POST /instances</Button
				>
				<Button size="sm" onclick={handleStatus} disabled={testLoading}>GET /status</Button>
				<Button size="sm" onclick={handleRestartDocker} disabled={testLoading}
					>POST /openclaw/restart</Button
				>
				<Button size="sm" onclick={handleReboot} disabled={testLoading}>POST /reboot</Button
				>
				<Button size="sm" onclick={handleReadFiles} disabled={testLoading}
					>POST /files/read</Button
				>
				<Button size="sm" onclick={handleWriteFiles} disabled={testLoading}
					>POST /files/write</Button
				>
				<Button size="sm" onclick={handleExec} disabled={testLoading}
					>POST /commands/exec</Button
				>
			</div>
			{#if testResult}
				<pre
					class="text-xs whitespace-pre-wrap break-all bg-muted p-3 rounded">{testResult}</pre>
			{/if}
		</Card>
	</div>
</div>
