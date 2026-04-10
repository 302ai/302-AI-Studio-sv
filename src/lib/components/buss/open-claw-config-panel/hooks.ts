/**
 *Description: open-claw-channel-panel and open-claw-config-panel using
 *Author: Leessmin
 *Date: 2026-03-23
 **/
import { codeAgentState } from "$lib/stores/code-agent";
import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
import { createLogger } from "@shared/logger";

const logger = createLogger("ui");

// hooks
export function ApplyOpenClawChannelConfigConfirm({
	prepareAction,
	finishAction,
	open,
	loading,
	error,
}: {
	prepareAction?: () => Promise<void>;
	finishAction?: () => Promise<void>;
	open: (arg: boolean) => void;
	loading: (arg: boolean) => void;
	error: (err: unknown) => void;
}) {
	const handleConfirmDialogOk = async () => {
		loading(true);
		try {
			await prepareAction?.();
			if (
				!codeAgentState.isPristineSession &&
				localEnvState.openClawHealthStatus !== "unknown"
			) {
				await window.electronAPI.localVibeService.restartPodmanMachine();
			}
		} catch (e) {
			error(e);
			logger.warn("OpenClaw config panel error:", e);
		} finally {
			finishAction?.();
			open(false);
			loading(false);
		}
	};

	return {
		handleConfirmDialogOk,
	};
}
