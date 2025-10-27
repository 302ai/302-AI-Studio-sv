import { app } from "electron";
import fs from "fs";
import path from "path";

export class UserDataManager {
	appName: string;

	constructor(appName: string) {
		this.appName = appName;
		this.setupUserDataPath();
	}

	private setupUserDataPath() {
		const basePath = app.getPath("appData");
		const userDataPath = path.join(basePath, this.appName);
		app.setPath("userData", userDataPath);
		this.ensureDirectoryExists(userDataPath);
		this.logPathInfo();
	}

	private ensureDirectoryExists(dirPath: string) {
		if (!fs.existsSync(dirPath)) {
			fs.mkdirSync(dirPath, { recursive: true });
		}
	}

	private logPathInfo() {
		console.log("========== 路径信息 ==========");
		console.log("平台:", process.platform);
		console.log("应用名称:", this.appName);
		console.log("userData 路径:", app.getPath("userData"));
		console.log("==============================");
	}
}
