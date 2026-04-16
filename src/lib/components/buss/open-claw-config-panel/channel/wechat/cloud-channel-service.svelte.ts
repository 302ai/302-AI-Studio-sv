import { execCommandStream } from "$lib/api/cloud-mode/base-apis";
import { cloudModeState } from "$lib/stores/code-agent/cloud-mode-state.svelte";
import { createLogger } from "@shared/logger";
import type { OpenClawWeixinLoginMsg } from "@shared/types";
import type { ChannelService } from "./channel-service";

const logger = createLogger("state");

class CloudChannelService implements ChannelService {
	loading = $state(false);
	error = $state(false);
	envState = $derived({
		sandboxRunning: cloudModeState.state.status == "running",
		serverInfo: {
			ip: cloudModeState.state.publicIp,
			port: cloudModeState.state.apiPort,
		},
	});
	fetchController: AbortController | null = null;

	constructor() {
		cloudModeState.loadInstances();
	}

	private messageFn: ((event: OpenClawWeixinLoginMsg) => void) | null = null;

	async isInstalled(): Promise<boolean> {
		return true;
	}

	async install(): Promise<boolean> {
		return true;
	}

	async connect(): Promise<void> {
		if (!cloudModeState.openClaw.status) {
			return;
		}

		const { serverInfo } = this.envState;
		if (serverInfo.ip.length <= 0 || serverInfo.port <= 0) {
			logger.error("openclaw-weixin:connect: server info not ready");
			return;
		}
		if (this.fetchController != null) return;
		this.fetchController = new AbortController();
		execCommandStream(
			serverInfo,
			{ command: "openclaw channels login --channel openclaw-weixin" },
			(data) => {
				const { text } = data;
				let d: OpenClawWeixinLoginMsg = {
					type: "unknown",
					data: text,
				};
				if (text.includes("https://liteapp.weixin.qq.com")) {
					d = {
						type: "url",
						data: text,
					};
				} else if (text.includes("微信连接成功")) {
					d = {
						type: "ok",
						data: text,
					};
				}
				this.messageFn?.(d);
			},
			{
				signal: this.fetchController.signal,
				onDone: () => {
					if (this.fetchController == null) {
						return;
					}
					this.fetchController?.abort();
					this.fetchController = null;
					this.connect();
				},
			},
		);
	}

	async dispose(): Promise<void> {
		this.fetchController?.abort();
		this.fetchController = null;
	}

	onMessage(callback: (event: OpenClawWeixinLoginMsg) => void): () => void {
		this.messageFn = callback;
		return () => {
			this.messageFn = null;
		};
	}
}

export const cloudChannelService = new CloudChannelService();
