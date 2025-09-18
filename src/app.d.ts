import type { Theme } from "@electron/shared/types";
import type { ElectronAPIExtension } from "../electron/main/generated/preload-services";

declare global {
	namespace App {}

	interface Window {
		electronAPI: ElectronAPIExtension;
		electronIPC: {
			onThemeChange: (callback: (theme: Theme) => void) => void;
		};
	}
}

export {};
