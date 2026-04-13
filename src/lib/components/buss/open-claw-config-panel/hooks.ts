/**
 *Description: open-claw-channel-panel and open-claw-config-panel using
 *Author: Leessmin
 *Date: 2026-03-23
 **/
import { createLogger } from "@shared/logger";

const logger = createLogger("ui");

// hooks
export function ApplyOpenClawChannelConfigConfirm({
	action,
	finishAction,
	open,
	loading,
	succeed,
	error,
}: {
	action?: () => Promise<void>;
	finishAction?: () => Promise<void>;
	open: (arg: boolean) => void;
	loading: (arg: boolean) => void;
	succeed: () => void;
	error: (err: unknown) => void;
}) {
	const handleConfirmDialogOk = async () => {
		loading(true);
		try {
			await action?.();
			succeed();
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
