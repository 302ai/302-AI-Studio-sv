import type { LanguageCode } from "@shared/storage/general-settings";
import { createLogger } from "@shared/logger";

const logger = createLogger("services");
import type { AiApplication } from "@shared/types";
import type { IpcMainInvokeEvent } from "electron";
import { isUndefined } from "es-toolkit";
import { nanoid } from "nanoid";
import { fetch302AIToolDetail, fetch302AIToolList } from "../../apis/ai-applications";
import { broadcastService, emitter } from "../broadcast-service";
import { generalSettingsService } from "../settings-service";
import { aiApplicationStorage } from "../storage-service/ai-application-storage";
import { providerStorage } from "../storage-service/provider-storage";
import { tabService } from "../tab-service";

const UNSUPPORTED_INJECTING_LANGUAGE: number[] = [
	9997, 9998, 9999, -1, 7, 11, 13, 19, 4, 5, 14, 17, 45, 48, 49, 8, 12, 15, 18, 23, 24,
];
const NEW_TOOLS_NOT_FROM_API: number[] = [9997, 9998, 9999];
const NEW_TOOLS_DEFAULT_URL: Record<number, string> = {
	9997: "https://3d-camera.302.ai/",
	9998: "https://nano-banana-md.302.ai/",
	9999: "https://nano-banana-ppt.302.ai/",
};

export class AiApplicationService {
	private aiApplicationUrlMap = new Map<string, string>();
	private aiApplicationList: AiApplication[] = [];

	constructor() {
		this.initAiApplications();
		emitter.on("general-settings:language-changed", ({ language }) => {
			this.initAiApplications(language);
		});
		emitter.on("provider:302ai-provider-changed", ({ apiKey }) => {
			this.handle302AIProviderChange(apiKey);
		});
	}

	// ******************************* Private Methods ******************************* //
	private async initAiApplications(language?: LanguageCode): Promise<void> {
		broadcastService.broadcastChannelToAll("ai-applications:loading", true);

		try {
			const lang = language ?? (await generalSettingsService.getLanguage());
			const langMap: Record<LanguageCode, "cn" | "en" | "jp"> = {
				zh: "cn",
				en: "en",
				// ja: "jp",
			};
			const collectedMap = new Map<number, boolean>();
			const [aiApplications, existingAiApplications] = await Promise.all([
				fetch302AIToolList(langMap[lang]),
				aiApplicationStorage.getAiApplications(),
			]);
			existingAiApplications.forEach((app) => {
				collectedMap.set(app.toolId, app.collected);
			});

			const aiApplicationState = aiApplications.map(
				({ tool_id, tool_name, tool_description, category_name, category_id }) => {
					return {
						id: nanoid(),
						toolId: tool_id,
						name: tool_name,
						description: tool_description,
						category: category_name,
						categoryId: category_id,
						collected: collectedMap.get(tool_id) ?? false,
						createdAt: new Date().toISOString(),
					};
				},
			);

			this.aiApplicationList = aiApplicationState;
			await this.updateAiApplicationUrlMap(aiApplicationState, lang);

			await aiApplicationStorage.setAiApplications(aiApplicationState);
		} catch (error) {
			logger.error("Failed to init ai applications:", error);
		} finally {
			broadcastService.broadcastChannelToAll("ai-applications:loading", false);
		}
	}

	private async updateAiApplicationUrlMap(
		apps: AiApplication[],
		language?: LanguageCode,
		updatedApiKey?: string,
	): Promise<void> {
		this.aiApplicationUrlMap.clear();

		let key = updatedApiKey;
		if (isUndefined(key)) {
			const { valid, apiKey } = await providerStorage.validate302AIProvider();
			if (!valid) return;
			key = apiKey;
		}

		try {
			const lang = language ?? (await generalSettingsService.getLanguage());

			// const userInfo = await fetch302AIUserInfo(key);
			// const uidBase64 = Buffer.from(userInfo.data.uid.toString(), "utf8").toString("base64");

			const aiApplicationDetail = await fetch302AIToolDetail(key);

			apps.forEach((app) => {
				const applicationIdStr = app.toolId.toString();
				const originalUrl = NEW_TOOLS_NOT_FROM_API.includes(app.toolId)
					? NEW_TOOLS_DEFAULT_URL[app.toolId] + `?key=${key}`
					: aiApplicationDetail.data.app_box_detail[applicationIdStr].url;
				const baseUrl = originalUrl.split("?")[0];
				const urlWithLang = UNSUPPORTED_INJECTING_LANGUAGE.includes(app.toolId)
					? originalUrl
					: `${baseUrl}/${lang}`;

				this.aiApplicationUrlMap.set(applicationIdStr, urlWithLang);
			});
		} catch (error) {
			broadcastService.broadcastChannelToAll("ai-applications:loading", false);
			logger.error("Failed to update ai application url map:", error);
		}
	}

	private async handle302AIProviderChange(updatedApiKey: string) {
		broadcastService.broadcastChannelToAll("ai-applications:loading", true);
		const lang = await generalSettingsService.getLanguage();
		await this.updateAiApplicationUrlMap(this.aiApplicationList, lang, updatedApiKey);
		broadcastService.broadcastChannelToAll("ai-applications:loading", false);
	}

	async handleAiApplicationReload(windowId: number): Promise<void> {
		const tabId = tabService.getActiveTabId(windowId);
		if (isUndefined(tabId)) return;

		const tabView = tabService.getTabView(tabId);
		if (isUndefined(tabView)) return;

		tabView.webContents.reload();
	}

	// ******************************* IPC Methods ******************************* //
	async getAiApplicationUrl(
		_event: IpcMainInvokeEvent,
		applicationId: number,
	): Promise<{
		isOk: boolean;
		url: string;
	}> {
		const applicationIdStr = applicationId.toString();
		const isOk = this.aiApplicationUrlMap.has(applicationIdStr);
		const url = isOk ? this.aiApplicationUrlMap.get(applicationIdStr)! : "";

		return {
			isOk,
			url,
		};
	}

	async handleAiApplicationReloadIpc(_event: IpcMainInvokeEvent, tabId: string): Promise<void> {
		const tabView = tabService.getTabView(tabId);
		if (isUndefined(tabView)) return;
		tabView.webContents.reload();
	}

	async refreshAiApplications(_event: IpcMainInvokeEvent): Promise<void> {
		await this.initAiApplications();
	}
}

export const aiApplicationService = new AiApplicationService();
