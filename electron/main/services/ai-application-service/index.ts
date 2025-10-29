import type { LanguageCode } from "@shared/storage/general-settings";
import type { AiApplication } from "@shared/types";
import type { IpcMainInvokeEvent } from "electron";
import { isUndefined } from "es-toolkit";
import { nanoid } from "nanoid";
import {
	fetch302AIToolDetail,
	fetch302AIToolList,
	fetch302AIUserInfo,
} from "../../apis/ai-applications";
import { broadcastService, emitter } from "../broadcast-service";
import { generalSettingsService } from "../settings-service";
import { aiApplicationStorage } from "../storage-service/ai-application-storage";
import { providerStorage } from "../storage-service/provider-storage";
import { tabService } from "../tab-service";

const UNSUPPORTED_INJECTING_LANGUAGE: number[] = [
	-1, 7, 11, 13, 19, 4, 5, 14, 17, 45, 48, 49, 8, 12, 15, 18, 23, 24,
];

export class AiApplicationService {
	private aiApplicationUrlMap = new Map<string, string>();
	private aiApplicationList: AiApplication[] = [];

	constructor() {
		this.initAiApplications();
		emitter.on("general-settings:language-changed", ({ language }) => {
			this.initAiApplications(language);
		});
	}

	// ******************************* Private Methods ******************************* //
	private async initAiApplications(language?: LanguageCode): Promise<void> {
		broadcastService.broadcastChannelToAll("ai-applications:loading", true);

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

		broadcastService.broadcastChannelToAll("ai-applications:loading", false);
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

			const userInfo = await fetch302AIUserInfo(key);
			const uidBase64 = Buffer.from(userInfo.data.uid.toString(), "utf8").toString("base64");
			const aiApplicationDetail = await fetch302AIToolDetail(uidBase64);

			apps.forEach((app) => {
				const applicationIdStr = app.toolId.toString();
				const originalUrl = aiApplicationDetail.data.app_box_detail[applicationIdStr].url;
				const baseUrl = originalUrl.split("?")[0];
				const urlWithLang = UNSUPPORTED_INJECTING_LANGUAGE.includes(app.toolId)
					? originalUrl
					: `${baseUrl}/${lang}`;

				this.aiApplicationUrlMap.set(applicationIdStr, urlWithLang);
			});
		} catch (error) {
			broadcastService.broadcastChannelToAll("ai-applications:loading", false);
			console.error("Failed to update ai application url map:", error);
		}
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

	async handle302AIProviderChange(
		_event: IpcMainInvokeEvent,
		updatedApiKey: string,
	): Promise<void> {
		broadcastService.broadcastChannelToAll("ai-applications:loading", true);
		const lang = await generalSettingsService.getLanguage();
		await this.updateAiApplicationUrlMap(this.aiApplicationList, lang, updatedApiKey);
		broadcastService.broadcastChannelToAll("ai-applications:loading", false);
	}

	async handleAiApplicationReload(_event: IpcMainInvokeEvent, tabId: string): Promise<void> {
		const tabView = tabService.getTabView(tabId);
		if (isUndefined(tabView)) return;

		tabView.webContents.reload();
	}
}

export const aiApplicationService = new AiApplicationService();
