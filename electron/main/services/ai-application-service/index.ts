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
		const aiApplications = await fetch302AIToolList(langMap[lang]);
		const aiApplicationState = aiApplications.map(
			({ tool_id, tool_name, tool_description, category_name, category_id }) => {
				return {
					id: nanoid(),
					toolId: tool_id,
					name: tool_name,
					description: tool_description,
					category: category_name,
					categoryId: category_id,
					collected: false,
					createdAt: new Date().toISOString(),
				};
			},
		);

		this.aiApplicationList = aiApplicationState;
		await this.updateAiApplicationUrlMap(aiApplicationState);

		await aiApplicationStorage.setAiApplications(aiApplicationState);

		broadcastService.broadcastChannelToAll("ai-applications:loading", false);
	}

	private async updateAiApplicationUrlMap(
		apps: AiApplication[],
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
			const userInfo = await fetch302AIUserInfo(key);
			const uidBase64 = Buffer.from(userInfo.data.uid.toString(), "utf8").toString("base64");
			const aiApplicationDetail = await fetch302AIToolDetail(uidBase64);

			apps.forEach((app) => {
				const applicationIdStr = app.toolId.toString();
				this.aiApplicationUrlMap.set(
					applicationIdStr,
					aiApplicationDetail.data.app_box_detail[applicationIdStr].url,
				);
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
		await this.updateAiApplicationUrlMap(this.aiApplicationList, updatedApiKey);
		broadcastService.broadcastChannelToAll("ai-applications:loading", false);
	}
}

export const aiApplicationService = new AiApplicationService();
