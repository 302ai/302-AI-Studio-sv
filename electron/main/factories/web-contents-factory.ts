import type { Tab } from "@shared/types";
import { WebContentsView } from "electron";
import path from "node:path";
import { stringify } from "superjson";
import { ENVIRONMENT } from "../constants";

export interface WebContentsConfig {
	windowId: number;
	type: "shell" | "tab" | "aiApplication";
	additionalArgs?: string[];
	onDestroyed?: () => void;
}

export interface TabWebContentsConfig extends WebContentsConfig {
	type: "tab";
	tab: Tab;
	threadFilePath: string;
	messagesFilePath: string;
}

export interface ShellWebContentsConfig extends WebContentsConfig {
	type: "shell";
}

export interface AiApplicationWebContentsConfig extends WebContentsConfig {
	type: "aiApplication";
}

export class WebContentsFactory {
	static create(config: WebContentsConfig): WebContentsView {
		const commonArgs = [`--window-id=${config.windowId}`];
		const additionalArgs = config.additionalArgs || [];

		const view = new WebContentsView({
			webPreferences: {
				preload: path.join(import.meta.dirname, "../preload/index.cjs"),
				devTools: ENVIRONMENT.IS_DEV,
				webgl: true,
				additionalArguments: [...commonArgs, ...additionalArgs],
				sandbox: false,
			},
		});

		// Add destroyed listener if callback provided
		if (config.onDestroyed) {
			view.webContents.on("destroyed", config.onDestroyed);
		}

		return view;
	}

	static createTabView(config: TabWebContentsConfig): WebContentsView {
		const additionalArgs = [
			`--tab=${stringify(config.tab)}`,
			`--thread-file=${config.threadFilePath}`,
			`--messages-file=${config.messagesFilePath}`,
		];

		return this.create({
			...config,
			additionalArgs,
		});
	}

	static createAiApplicationView(config: AiApplicationWebContentsConfig): WebContentsView {
		return this.create(config);
	}

	static createShellView(config: ShellWebContentsConfig): WebContentsView {
		return this.create(config);
	}
}
