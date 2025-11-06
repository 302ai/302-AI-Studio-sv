import type { InsertTarget } from "@shared/types";
import { BrowserWindow, screen, type IpcMainInvokeEvent } from "electron";
import { TITLE_BAR_HEIGHT } from "../../constants";
import { broadcastService } from "../broadcast-service";

export class GhostWindowService {
	private updateInterval: NodeJS.Timeout | null = null;
	private lastPointerPosition: { x: number; y: number } | null = null;
	private currentHoveredWindowId: string | null = null;
	private currentInsertTarget: InsertTarget | null = null;

	async startTracking(_event: IpcMainInvokeEvent): Promise<void> {
		console.log("[GhostWindowService] Starting mouse tracking for drag operation");

		try {
			// Get current cursor position
			const cursorPos = screen.getCursorScreenPoint();
			this.lastPointerPosition = { x: cursorPos.x, y: cursorPos.y };

			// Start polling
			this.startPolling();

			console.log(
				`[GhostWindowService] Mouse tracking started at (${cursorPos.x}, ${cursorPos.y})`,
			);
		} catch (error) {
			console.error("[GhostWindowService] Failed to start tracking:", error);
			throw error;
		}
	}

	async stopTracking(_event: IpcMainInvokeEvent): Promise<void> {
		console.log("[GhostWindowService] Stopping mouse tracking");

		this.stopPolling();

		// Clear any hover state
		if (this.currentHoveredWindowId) {
			this.clearHoverState(this.currentHoveredWindowId);
		}

		this.lastPointerPosition = null;
		this.currentHoveredWindowId = null;
		this.currentInsertTarget = null;

		console.log("[GhostWindowService] Mouse tracking stopped");
	}

	async updateInsertIndex(_event: IpcMainInvokeEvent, target: InsertTarget): Promise<void> {
		this.currentInsertTarget = target;
		console.log(
			`[GhostWindowService] Updated insert target to window ${target.windowId} at index ${target.insertIndex}`,
		);
	}

	/**
	 * Internal synchronous method for backend services.
	 * Called by dropAtPointer before stopTracking() clears the target.
	 */
	getCurrentInsertTargetSync(): InsertTarget | null {
		return this.currentInsertTarget;
	}

	private startPolling(): void {
		if (this.updateInterval) {
			return;
		}

		// Poll at 60Hz
		this.updateInterval = setInterval(() => {
			this.updateMousePosition();
		}, 1000 / 60);

		console.log("[GhostWindowService] Started polling at 60Hz");
	}

	private stopPolling(): void {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = null;
			console.log("[GhostWindowService] Stopped polling");
		}
	}

	private updateMousePosition(): void {
		// Get current cursor position
		const cursorPos = screen.getCursorScreenPoint();

		// Only update if position changed
		if (
			this.lastPointerPosition &&
			cursorPos.x === this.lastPointerPosition.x &&
			cursorPos.y === this.lastPointerPosition.y
		) {
			return;
		}

		this.lastPointerPosition = { x: cursorPos.x, y: cursorPos.y };

		// Find window at cursor position
		const targetWindowData = this.findWindowAtPoint(cursorPos.x, cursorPos.y);

		if (targetWindowData) {
			const { win: targetWindow, windowId: targetWindowId } = targetWindowData;

			// Check if pointer is in titlebar
			if (this.isPointInTitlebar(targetWindow, cursorPos.x, cursorPos.y)) {
				// Convert to client coordinates
				const windowBounds = targetWindow.getBounds();
				const clientX = cursorPos.x - windowBounds.x;
				const clientY = cursorPos.y - windowBounds.y;

				// Send hover event to titlebar
				if (this.currentHoveredWindowId !== targetWindowId) {
					// Clear previous hover state
					if (this.currentHoveredWindowId) {
						this.clearHoverState(this.currentHoveredWindowId);
					}
					this.currentHoveredWindowId = targetWindowId;
				}

				this.sendHoverEvent(targetWindowId, clientX, clientY);
				return;
			}
		}

		// No valid target, clear hover state
		if (this.currentHoveredWindowId) {
			this.clearHoverState(this.currentHoveredWindowId);
			this.currentHoveredWindowId = null;
		}
	}

	private sendHoverEvent(windowId: string, clientX: number, clientY: number): void {
		const targetWindow = this.getWindowById(windowId);
		if (!targetWindow) return;

		// Broadcast to all shell windows (shell view will receive it)
		broadcastService.broadcastChannelToAll("tab:drag:ghost:hover", {
			windowId,
			clientX,
			clientY,
			draggedWidth: 120, // Default width for indicator calculation
		});
	}

	private clearHoverState(windowId: string): void {
		// Broadcast clear to all windows
		broadcastService.broadcastChannelToAll("tab:drag:ghost:clear", { windowId });
	}

	private findWindowAtPoint(
		screenX: number,
		screenY: number,
	): { win: BrowserWindow; windowId: string } | null {
		const allWindows = BrowserWindow.getAllWindows();

		// Heuristic: prefer the currently focused window if it contains the point
		const focused = BrowserWindow.getFocusedWindow();
		if (focused && !focused.isDestroyed()) {
			const fb = focused.getBounds();
			const withinFocused =
				screenX >= fb.x &&
				screenX <= fb.x + fb.width &&
				screenY >= fb.y &&
				screenY <= fb.y + fb.height;
			const focusedId = focused.id.toString();
			if (withinFocused && focusedId) {
				return { win: focused, windowId: focusedId };
			}
		}

		// Fall back: scan all windows and pick the first that contains the point
		for (const win of allWindows) {
			if (win.isDestroyed()) continue;
			const bounds = win.getBounds();
			const within =
				screenX >= bounds.x &&
				screenX <= bounds.x + bounds.width &&
				screenY >= bounds.y &&
				screenY <= bounds.y + bounds.height;
			if (!within) continue;
			const windowId = win.id.toString();
			if (windowId) return { win, windowId };
		}
		return null;
	}

	private isPointInTitlebar(win: BrowserWindow, x: number, y: number): boolean {
		const bounds = win.getBounds();
		const relativeX = x - bounds.x;
		const relativeY = y - bounds.y;

		return (
			relativeX >= 0 && relativeX <= bounds.width && relativeY >= 0 && relativeY <= TITLE_BAR_HEIGHT
		);
	}

	private getWindowById(windowId: string): BrowserWindow | undefined {
		const numericId = Number.parseInt(windowId, 10);
		if (Number.isNaN(numericId)) return undefined;

		const win = BrowserWindow.fromId(numericId);
		return win && !win.isDestroyed() ? win : undefined;
	}
}

export const ghostWindowService = new GhostWindowService();
