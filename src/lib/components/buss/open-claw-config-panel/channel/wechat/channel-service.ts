import type { OpenClawWeixinLoginMsg } from "@shared/types";

/**
 * Interface for channel services that support QR-code-based login flow.
 * Implement this interface for each channel (wechat, feishu, etc.)
 * and pass the implementation to the channel component via prop.
 */
export interface ChannelService {
	/** Check if the channel plugin is installed */
	isInstalled(): Promise<boolean>;

	/** Install the channel plugin. Returns true on success. */
	install(): Promise<boolean>;

	/** Start the login/connect flow (triggers message events) */
	connect(): Promise<void>;

	/** Dispose/cleanup the connection */
	dispose(): Promise<void>;

	/** Subscribe to login messages. Returns an unsubscribe function. */
	onMessage(callback: (event: OpenClawWeixinLoginMsg) => void): () => void;

	/** Reactive loading state for install */
	loading: boolean;

	/** Reactive error state for install */
	error: boolean;

	/** Reactive state for sandbox running */
	envState: {
		sandboxRunning: boolean;
	};
}
