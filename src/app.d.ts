import type { Theme } from "../electron/shared/types";

declare global {
	namespace App {}

	interface Window {
		electronAPI: {
			theme: {
				setTheme: (theme: Theme) => void;
				onThemeChange: (callback: (theme: Theme) => void) => void;
				getCurrentTheme: () => Promise<Theme>;
			};
		};
		service: {
			attachmentsService: {
				openExternal: (url: string) => Promise<void>;
			};
		};
	}
}

export {};
