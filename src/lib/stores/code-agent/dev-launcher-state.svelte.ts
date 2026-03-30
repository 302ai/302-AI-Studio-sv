/**
 * Minimal state store for the hidden dev sandbox launcher.
 * Tracks launch/stop state and errors — no log management.
 */
class DevLauncherState {
	isLaunching = $state(false);
	isRunning = $state(false);
	error = $state<string | null>(null);

	async launch(imageAddress: string, engine: "podman" | "docker"): Promise<void> {
		this.isLaunching = true;
		this.error = null;
		try {
			const result = await window.electronAPI.devLauncherService.launchDevSandbox(
				imageAddress,
				engine,
			);
			this.isRunning = result.isOk;
			if (!result.isOk) this.error = result.error ?? "Launch failed";
		} finally {
			this.isLaunching = false;
		}
	}

	async stop(): Promise<void> {
		this.error = null;
		try {
			const result = await window.electronAPI.devLauncherService.stopDevSandbox();
			if (result.isOk) this.isRunning = false;
			else this.error = result.error ?? "Stop failed";
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
		}
	}
}

export const devLauncherState = new DevLauncherState();
