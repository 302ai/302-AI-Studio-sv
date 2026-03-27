<script lang="ts">
	import { AccordionContent, AccordionItem, AccordionTrigger } from "$lib/components/ui/accordion";
	import Accordion from "$lib/components/ui/accordion/accordion.svelte";
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { getLocale } from "$lib/paraglide/runtime";
	import { ArrowDownToLine, CircleAlert } from "@lucide/svelte";
	import type { OpenClawWeixinLoginMsg } from "@shared/types";
	import QRCodeStyling from "qr-code-styling";
	import { onMount, tick } from "svelte";
	import { toast } from "svelte-sonner";
	import { LdrsLoader } from "../../ldrs-loader";

	let wechatElm = $state<HTMLDivElement | null>(null);
	const qrCode = new QRCodeStyling();
	onMount(() => {
		if (wechatElm) {
			qrCode.append(wechatElm);
		}
	});
	let wechatState = $state({
		loading: false,
		text: "",
		installed: false,
		error: false,
	});
	const wechatQRListener = new Map([
		[
			"ok",
			(_: OpenClawWeixinLoginMsg) => {
				toast.success(m.open_claw_wechat_add_success());
				wechatState.error = false;
			},
		],
		[
			"error",
			(_: OpenClawWeixinLoginMsg) => {
				toast.error(m.open_claw_wechat_qrcode_fetch_failed());
				wechatState.error = true;
				wechatState.loading = false;
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
				wechatState.loading = false;
				wechatState.error = false;
				{
					await tick();
					if (!wechatElm) return;
					const canvas = wechatElm.querySelector("canvas");
					if (canvas) {
						canvas.className = "w-full h-full";
					}
				}
			},
		],
		[
			"unknown",
			(event: OpenClawWeixinLoginMsg) => {
				console.log("unknown", event);
			},
		],
		[
			"close",
			(event: OpenClawWeixinLoginMsg) => {
				if (!wechatState.installed) return;

				if (event.data != "manual") {
					window.electronAPI.openClawService.connectWechat();
				}
			},
		],
		[
			"install",
			(_: OpenClawWeixinLoginMsg) => {
				wechatState.text = m.plugins_install_installing();
			},
		],
		[
			"installed",
			(_: OpenClawWeixinLoginMsg) => {
				wechatState.installed = true;
			},
		],
	]);

	$effect(() => {
		const unsubscribe = window.electronAPI.openClaw.onWeiXinLoginInformation((event) => {
			const typ = event.type;

			const fn = wechatQRListener.has(typ)
				? wechatQRListener.get(typ)
				: wechatQRListener.get("unknown");
			fn?.(event);
		});

		return () => {
			unsubscribe();
			window.electronAPI.openClawService.disposeWechat();
		};
	});

	let wechatTriggerSignal = 0;
	const handleWechartTrigger = async (signal: string) => {
		wechatState.installed = await window.electronAPI.openClawService.wechatInsalled();
		if (!wechatState.installed) return;

		if (signal.length <= 0 || wechatTriggerSignal >= 1) return;
		handleWechatConnectOrInstall();
		wechatTriggerSignal++;
	};

	const handleWechatConnectOrInstall = async () => {
		wechatState.loading = true;
		wechatState.error = false;
		await window.electronAPI.openClawService.connectWechat();
	};

	const getWechatTutorialUrl = () => {
		const lang = getLocale() === "en" ? "en" : "zh";
		return `https://studio.302.ai/${lang}/docs/advanced/open-claw/wecom`;
	};
</script>

<Accordion type="single" class="w-full rounded-settings-item" onValueChange={handleWechartTrigger}>
	<AccordionItem value="wechat" class="border-b-0">
		<AccordionTrigger class="py-3.5 px-4 bg-input hover:no-underline">
			<Label class=" font-normal no-underline cursor-pointer">{m.open_claw_channel_wechat()}</Label>
		</AccordionTrigger>
		<AccordionContent class="pb-0 pt-2 space-y-2">
			<div class="rounded-lg border p-4 space-y-4">
				<div class="flex justify-between">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<div>
						<div class={`${!wechatState.installed && "hidden"}`}>
							<label class="text-sm text-label-fg font-medium"
								>{m.open_claw_wechat_scan_qrcode_hint()}</label
							>
							<div
								class="w-36 h-36 mt-1 relative flex flex-col items-center justify-center bg-muted rounded-md"
							>
								{#if wechatState.loading}
									<!-- <LoaderCircle class="h-8 w-8 animate-spin text-muted-foreground" /> -->
									<LdrsLoader type="line-spinner" />
									<span class="text-label-fg mt-1 text-xs">{wechatState.text}</span>
								{/if}
								<div
									bind:this={wechatElm}
									class={`size-full ${wechatState.loading || !wechatState.installed ? "hidden" : ""}`}
								></div>
							</div>
						</div>
						<div class="flex items-center justify-between">
							<div class="text-muted-foreground flex items-center gap-2 text-xs">
								<a href={getWechatTutorialUrl()} class="text-primary hover:underline"
									>{m.open_claw_feishu_view_deployment_tutorial()}</a
								>
							</div>
						</div>
					</div>
					<!-- weChartInstalled -->
					{#if !wechatState.installed}
						<div class="flex flex-col items-end">
							<Button
								class="w-fit"
								disabled={wechatState.loading || wechatState.installed}
								onclick={handleWechatConnectOrInstall}
							>
								{#if wechatState.loading}
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
							<p class="text-red-500 text-xs">
								{wechatState.error ? m.open_claw_wechat_install_failed_retry() : ""}
							</p>
						</div>
					{/if}
				</div>
			</div>
		</AccordionContent>
	</AccordionItem>
</Accordion>
