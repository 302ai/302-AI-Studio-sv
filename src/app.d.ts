import type { Theme } from "@electron/shared/types";
import type { ElectronAPIExtension } from "../generated/preload-services";

declare global {
	namespace App {}

	interface Window {
		electronAPI: {
			theme: {
				setTheme: (theme: Theme) => void;
				onThemeChange: (callback: (theme: Theme) => void) => void;
				getCurrentTheme: () => Promise<Theme>;
			};
		} & ElectronAPIExtension;
		service: {
			attachmentsService: {
				openExternal: (url: string) => Promise<void>;
				openExternal2: (url: string) => Promise<void>;
				openExternal3: (url: string) => Promise<void>;
			};
		};
	}
}

export {};
