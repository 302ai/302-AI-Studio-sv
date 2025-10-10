import type { LanguageCode } from "@shared/storage/general-settings";
import type { AiApplication } from "@shared/types";
import { nanoid } from "nanoid";
import { fetch302AIToolList } from "../../apis/ai-applications";
import { generalSettingsService } from "../general-setting-service";
import { aiApplicationStorage } from "../storage-service/ai-application-storage";

export class AiApplicationService {
	constructor() {
		this.initAiApplications();
	}

	private async initAiApplications(): Promise<void> {
		const language = await generalSettingsService.getLanguage();
		const langMap: Record<LanguageCode, "cn" | "en" | "jp"> = {
			zh: "cn",
			en: "en",
			// ja: "jp",
		};
		const _lang = langMap[language];
		const aiApplications = await fetch302AIToolList(_lang);
		const aiApplicationState: AiApplication[] = [];
		aiApplications.forEach((aiApplication) => {
			aiApplicationState.push({
				id: nanoid(),
				toolId: aiApplication.tool_id,
				name: aiApplication.tool_name,
				description: aiApplication.tool_description,
				category: aiApplication.category_name,
				categoryId: aiApplication.category_id,
				collected: false,
				createdAt: new Date().toISOString(),
			});
		});

		console.log(aiApplicationState);

		await aiApplicationStorage.setAiApplications(aiApplicationState);
	}
}

export const aiApplicationService = new AiApplicationService();
