export class WindowService {
	private isMaximized = false;
	private isMinimized = false;

	constructor() {
		console.log("WindowService initialized");
	}

	async maximize(_event: Electron.IpcMainInvokeEvent): Promise<void> {
		this.isMaximized = true;
		console.log("Window maximized");
	}

	async minimize(_event: Electron.IpcMainInvokeEvent): Promise<void> {
		this.isMinimized = true;
		console.log("Window minimized");
	}

	async restore(_event: Electron.IpcMainInvokeEvent): Promise<void> {
		this.isMaximized = false;
		this.isMinimized = false;
		console.log("Window restored");
	}

	async close(_event: Electron.IpcMainInvokeEvent): Promise<void> {
		console.log("Window close requested");
	}

	async getWindowState(_event: Electron.IpcMainInvokeEvent): Promise<{
		isMaximized: boolean;
		isMinimized: boolean;
		width: number;
		height: number;
	}> {
		return {
			isMaximized: this.isMaximized,
			isMinimized: this.isMinimized,
			width: 1200,
			height: 800,
		};
	}

	async setWindowSize(
		_event: Electron.IpcMainInvokeEvent,
		width: number,
		height: number,
	): Promise<void> {
		console.log(`Setting window size to ${width}x${height}`);
	}

	async sayHello(_event: Electron.IpcMainInvokeEvent): Promise<string> {
		return "Hello from WindowService!";
	}
}
