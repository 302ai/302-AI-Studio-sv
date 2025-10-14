import type { LanguageCode } from "@shared/storage/general-settings";
import type { AiApplication } from "@shared/types";
import type { IpcMainInvokeEvent } from "electron";
import { nanoid } from "nanoid";
import {
	fetch302AIToolDetail,
	fetch302AIToolList,
	fetch302AIUserInfo,
} from "../../apis/ai-applications";
import { generalSettingsService } from "../settings-service";
import { aiApplicationStorage } from "../storage-service/ai-application-storage";
import { providerStorage } from "../storage-service/provider-storage";

export class AiApplicationService {
	private aiApplicationUrlMap = new Map<string, string>();
	private aiApplicationList: AiApplication[] = [];

	constructor() {
		this.initAiApplications();
	}

	// ******************************* Private Methods ******************************* //
	private async initAiApplications(): Promise<void> {
		const language = await generalSettingsService.getLanguage();
		const langMap: Record<LanguageCode, "cn" | "en" | "jp"> = {
			zh: "cn",
			en: "en",
			// ja: "jp",
		};
		const aiApplications = await fetch302AIToolList(langMap[language]);
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
	}

	private async updateAiApplicationUrlMap(apps: AiApplication[]): Promise<void> {
		this.aiApplicationUrlMap.clear();

		const { valid, apiKey } = await providerStorage.validate302AIProvider();
		if (!valid) return;

		try {
			const userInfo = await fetch302AIUserInfo(apiKey);
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

	async handle302AIProviderChange(_event: IpcMainInvokeEvent): Promise<void> {
		await this.updateAiApplicationUrlMap(this.aiApplicationList);
	}
}

export const aiApplicationService = new AiApplicationService();
