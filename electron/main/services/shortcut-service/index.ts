import type {
	ShortcutBinding,
	ShortcutConflict,
	ShortcutKeyPressEvent,
	ShortcutSyncEvent,
} from "@shared/types/shortcut";
import type { IpcMainInvokeEvent } from "electron";
import { ipcMain, webContents } from "electron";
import { ShortcutEngine } from "./engine";
import { shortcutActionsHandler } from "./actions-handler";

export class ShortcutService {
	private engine: ShortcutEngine;
	private keyPressedListenerSetup = false;

	constructor() {
		this.engine = new ShortcutEngine();
	}

	async init(event: IpcMainInvokeEvent, shortcuts: ShortcutBinding[]): Promise<void> {
		this.engine.init(shortcuts, async (action, ctx) => {
			await shortcutActionsHandler.handle(action, ctx);
		});

		// Setup key-pressed listener only once
		if (!this.keyPressedListenerSetup) {
			this.setupKeyPressedListener();
			this.keyPressedListenerSetup = true;
		}

		const allWebContents = webContents.getAllWebContents();
		allWebContents.forEach((wc) => {
			if (!wc.isDestroyed()) {
				wc.send("shortcut:sync", this.engine.getSyncInfo());
			}
		});
	}

	private setupKeyPressedListener(): void {
		ipcMain.on("shortcut:key-pressed", (_event, keyEvent: ShortcutKeyPressEvent) => {
			// Handle key press from renderer (especially for webview scope)
			this.engine.handleKeyPressed(keyEvent);
		});
	}

	async updateShortcuts(event: IpcMainInvokeEvent, shortcuts: ShortcutBinding[]): Promise<void> {
		this.engine.updateShortcuts(shortcuts);

		const allWebContents = webContents.getAllWebContents();
		allWebContents.forEach((wc) => {
			if (wc !== event.sender && !wc.isDestroyed()) {
				wc.send("shortcut:sync", this.engine.getSyncInfo());
			}
		});
	}

	async getConflicts(_event: IpcMainInvokeEvent): Promise<ShortcutConflict[]> {
		return this.engine.getConflicts();
	}

	async getSyncInfo(_event: IpcMainInvokeEvent): Promise<ShortcutSyncEvent> {
		return this.engine.getSyncInfo();
	}

	getEngine(): ShortcutEngine {
		return this.engine;
	}
}

export const shortcutService = new ShortcutService();
