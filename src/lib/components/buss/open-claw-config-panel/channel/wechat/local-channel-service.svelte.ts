import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
import type { OpenClawWeixinLoginMsg } from "@shared/types";
import type { ChannelService } from "./channel-service";

class LocalChannelService implements ChannelService {
	loading = $state(false);
	error = $state(false);
	envState = $derived({
		sandboxRunning: localEnvState.sandboxRunning,
	});

	constructor() {
		localEnvState.startSandboxListening();
	}

	async isInstalled(): Promise<boolean> {
		return await window.electronAPI.openClawService.wechatInsalled();
	}

	async install(): Promise<boolean> {
		try {
			this.loading = true;
			const success = await window.electronAPI.openClawService.installWechat();
			this.error = !success;
		} catch (_e) {
			this.error = true;
		} finally {
			this.loading = false;
		}
		return !this.error;
	}

	async connect(): Promise<void> {
		await window.electronAPI.openClawService.connectWechat();
	}

	async dispose(): Promise<void> {
		await window.electronAPI.openClawService.disposeWechat();
	}

	onMessage(callback: (event: OpenClawWeixinLoginMsg) => void): () => void {
		return window.electronAPI.openClaw.onWeiXinLoginInformation(callback);
	}
}

export const localChannelService = new LocalChannelService();
