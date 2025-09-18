import { BrowserWindow } from "electron";
import path from "node:path";
import { WINDOW_SIZE, CONFIG, PLATFORM } from "../../constants";

interface TabData {
	id: string;
	title: string;
	href: string;
	closable?: boolean;
}

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

	async createDetachedWindow(
		_event: Electron.IpcMainInvokeEvent,
		tabData: TabData,
		mousePosition?: { x: number; y: number }
	): Promise<void> {
		try {
			const { nativeTheme } = await import("electron");

			// Calculate window position near mouse cursor if provided
			const defaultX = 100;
			const defaultY = 100;
			const x = mousePosition?.x ? mousePosition.x - 200 : defaultX;
			const y = mousePosition?.y ? mousePosition.y - 100 : defaultY;

			// Create new browser window with similar configuration to main window
			const detachedWindow = new BrowserWindow({
				x,
				y,
				width: WINDOW_SIZE.MIN_WIDTH,
				height: WINDOW_SIZE.MIN_HEIGHT,
				minWidth: WINDOW_SIZE.MIN_WIDTH,
				minHeight: WINDOW_SIZE.MIN_HEIGHT,
				autoHideMenuBar: true,
				transparent: PLATFORM.IS_MAC,
				frame: PLATFORM.IS_LINUX ? false : undefined,
				visualEffectState: "active",
				titleBarStyle: PLATFORM.IS_MAC ? "hiddenInset" : "hidden",
				titleBarOverlay: !PLATFORM.IS_MAC
					? nativeTheme.shouldUseDarkColors
						? CONFIG.TITLE_BAR_OVERLAY.DARK
						: CONFIG.TITLE_BAR_OVERLAY.LIGHT
					: undefined,
				backgroundColor: nativeTheme.shouldUseDarkColors ? "#2d2d2d" : "#f1f1f1",
				trafficLightPosition: PLATFORM.IS_MAC ? { x: 12, y: 12 } : undefined,
				...(PLATFORM.IS_LINUX && {
					thickFrame: false,
					resizable: true,
					skipTaskbar: false,
				}),
				webPreferences: {
					preload: path.join(import.meta.dirname, "../preload/index.js"),
					devTools: true,
					webgl: true,
				},
				roundedCorners: true,
			});

			// Store the tab data to be accessed by the new window
			(detachedWindow as BrowserWindow & { initialTabData: TabData }).initialTabData = tabData;

			// Load the application with the tab data as URL parameter
			const tabDataParam = encodeURIComponent(JSON.stringify(tabData));

			if (process.env.NODE_ENV === 'development') {
				// In development, use the dev server URL from the main window
				const mainWindows = BrowserWindow.getAllWindows();
				console.log("All windows:", mainWindows.length);

				const mainWindow = mainWindows.find(w => w !== detachedWindow);
				if (mainWindow) {
					const currentURL = mainWindow.webContents.getURL();
					console.log("Main window URL:", currentURL);
					const baseURL = currentURL.split('?')[0];
					const newURL = `${baseURL}?detachedTab=${tabDataParam}`;
					console.log("Loading detached window with URL:", newURL);
					detachedWindow.loadURL(newURL);
					detachedWindow.webContents.on("did-frame-finish-load", () => {
						detachedWindow.webContents.openDevTools({ mode: "detach" });
					});
				} else {
					console.error("No main window found for URL reference");
					// Fallback to default dev server URL
					detachedWindow.loadURL(`http://localhost:5173?detachedTab=${tabDataParam}`);
				}
			} else {
				detachedWindow.loadURL(`app://localhost?detachedTab=${tabDataParam}`);
			}

			console.log("Created detached window for tab:", tabData.title);
		} catch (error) {
			console.error("Error creating detached window:", error);
			throw error;
		}
	}
}
