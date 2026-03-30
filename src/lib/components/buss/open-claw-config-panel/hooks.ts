/**
 *Description: open-claw-channel-panel and open-claw-config-panel using
 *Author: Leessmin
 *Date: 2026-03-23
 **/
import { m } from "$lib/paraglide/messages";
import { codeAgentState } from "$lib/stores/code-agent";
import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
import { toast } from "svelte-sonner";

// hooks
export function ApplyOpenClawChannelConfigConfirm({
	prepareAction,
	finishAction,
	open,
	loading,
}: {
	prepareAction?: () => Promise<void>;
	finishAction?: () => Promise<void>;
	open: (arg: boolean) => void;
	loading: (arg: boolean) => void;
}) {
	const handleConfirmDialogOk = async () => {
		loading(true);
		try {
			await prepareAction?.();
			if (!codeAgentState.isPristineSession && localEnvState.openClawHealthStatus !== "unknown") {
				await window.electronAPI.localVibeService.restartPodmanMachine();
			}
		} catch (e) {
			const error = e as NodeJS.ErrnoException;
			if (error.code === "ENOENT") {
				const toastId = "local-code-agent-connection-error";
				const isAlreadyVisible = toast.getActiveToasts().some((t) => t.id === toastId);

				if (!localEnvState.sandboxStarting && !isAlreadyVisible) {
					toast.error(m.code_agent_local_container_not_started(), {
						id: toastId,
						action: {
							label: m.toast_button_start_sandbox(),
							onClick: async () => {
								await localEnvState.startSandbox();
							},
						},
					});
				}
			}
			console.warn(e);
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
