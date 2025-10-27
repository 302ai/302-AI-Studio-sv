import { app } from "electron";
import fs from "fs";
import path from "path";

export class UserDataManager {
	appName: string;
	storagePath: string;

	constructor(appName: string) {
		this.appName = appName;
		this.storagePath = this.setupUserDataPath();
	}

	private setupUserDataPath(): string {
		const basePath = app.getPath("appData");
		const userDataPath = path.join(basePath, this.appName);
		app.setPath("userData", userDataPath);
		this.ensureDirectoryExists(userDataPath);
		this.logPathInfo();
		return userDataPath;
	}

	private ensureDirectoryExists(dirPath: string) {
		if (!fs.existsSync(dirPath)) {
			fs.mkdirSync(dirPath, { recursive: true });
		}
	}

	private logPathInfo() {
		console.log("========== 路径信息 ==========");
		console.log("平台:", process.platform);
		console.log("userData 路径:", app.getPath("userData"));
		console.log("==============================");
	}
}

export const userDataManager = new UserDataManager("com.302ai.302aistudio");
