<script lang="ts">
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader";
	import { Button } from "$lib/components/ui/button";
	import { m } from "$lib/paraglide/messages";
	import { ArrowDownToLine, CircleAlert } from "@lucide/svelte";
	import { createLogger } from "@shared/logger";
	import type { OpenClawWeixinLoginMsg } from "@shared/types";
	import QRCodeStyling from "qr-code-styling";
	import { onMount, tick } from "svelte";
	import { toast } from "svelte-sonner";
	import type { ChannelService } from "./channel-service";

	type Props = {
		label: string;
		service: ChannelService;
	};

	const logger = createLogger("ui");

	let { service, label }: Props = $props();

	let qrElm = $state<HTMLDivElement | null>(null);
	const qrCode = new QRCodeStyling();

	let loginState = $state({
		loading: false,
		installed: false,
	});

	onMount(() => {
		if (qrElm) {
			qrCode.append(qrElm);
		}
	});

	onMount(async () => {
		loginState.installed = await service.isInstalled();
	});

	// Auto-trigger connect when component mounts (i.e. when Accordion expands)
	/* onMount(() => {
		if (!service.envState.sandboxRunning) {
			toast.error(m.code_agent_local_container_not_started());
			return;
		}
		handleConnect();
	});
 */
	$effect(() => {
		if (!service.envState.sandboxRunning) {
			// toast.error(m.code_agent_local_container_not_started());
			return;
		}
		handleConnect();
	});

	const messageHandlers = new Map([
		[
			"ok",
			(_: OpenClawWeixinLoginMsg) => {
				toast.success(m.open_claw_wechat_add_success());
			},
		],
		[
			"error",
			(_: OpenClawWeixinLoginMsg) => {
				toast.error(m.open_claw_wechat_qrcode_fetch_failed());
				loginState.loading = false;
				handleConnect();
			},
		],
		[
			"url",
			async (event: OpenClawWeixinLoginMsg) => {
				qrCode.update({
					width: 200,
					height: 200,
					type: "canvas",
					data: event.data,
					image: "/icon.png",
					margin: 0,
					dotsOptions: {
						color: "#000",
						type: "rounded",
					},
				});
				loginState.loading = false;
				{
					await tick();
					if (!qrElm) return;
					const canvas = qrElm.querySelector("canvas");
					if (canvas) {
						canvas.className = "w-full h-full";
					}
				}
			},
		],
		[
			"unknown",
			(event: OpenClawWeixinLoginMsg) => {
				logger.info("unknown", event);
			},
		],
		[
			"close",
			(event: OpenClawWeixinLoginMsg) => {
				if (event.data == "normal") {
					handleConnect();
				}
			},
		],
	]);

	$effect(() => {
		const unsubscribe = service.onMessage((event) => {
			const typ = event.type;
			const fn = messageHandlers.has(typ)
				? messageHandlers.get(typ)
				: messageHandlers.get("unknown");
			fn?.(event);
		});

		return () => {
			unsubscribe();
			service.dispose();
		};
	});

	const handleConnect = async () => {
		loginState.loading = true;
		await service.connect();
	};

	const handleInstall = async () => {
		if (!service.envState.sandboxRunning) {
			toast.error(m.code_agent_local_container_not_started());
			return;
		}
		service.install().then((success) => {
			loginState.installed = success;
			if (loginState.installed) {
				handleConnect();
			}
		});
	};
</script>

<div class="rounded-lg border p-4 space-y-4">
	<div class="flex justify-between">
		<!-- svelte-ignore a11y_label_has_associated_control -->
		<div>
			<div class={`${!loginState.installed && "hidden"}`}>
				<label class="text-sm text-label-fg font-medium">{label}</label>
				<div
					class="w-36 h-36 mt-1 relative flex flex-col items-center justify-center bg-muted rounded-md"
				>
					{#if loginState.loading}
						<LdrsLoader type="line-spinner" />
						<span class="text-label-fg mt-1 text-xs">{m.changelog_loading()}</span>
					{/if}
					<div
						bind:this={qrElm}
						class={`size-full ${loginState.loading || !loginState.installed ? "hidden" : ""}`}
					></div>
				</div>
			</div>
			<div class="flex items-center justify-between">
				<div class="text-muted-foreground flex items-center gap-2 text-xs">
					<a
						href="https://studio.302.ai/zh/docs/advanced/open-claw/wechat"
						class="text-primary hover:underline"
						>{m.open_claw_feishu_view_deployment_tutorial()}</a
					>
				</div>
			</div>
		</div>
		{#if !loginState.installed}
			<div class="flex flex-col items-end">
				<Button class="w-fit" disabled={service.loading} onclick={handleInstall}>
					{#if service.loading}
						<LdrsLoader type="dot-pulse" size={10} />
					{:else}
						<ArrowDownToLine class="size-4" />
					{/if}
					{m.open_claw_wechat_install_plugin()}
				</Button>
				<div class="flex items-center mt-1 text-red-500 text-xs">
					<CircleAlert class="size-4" />
					<span>{m.open_claw_wechat_install_restart_gateway()}</span>
				</div>
				{#if service.error}
					<p class="text-red-500 text-xs">
						{m.open_claw_wechat_install_failed_retry()}
					</p>
				{/if}
			</div>
		{/if}
	</div>
</div>
