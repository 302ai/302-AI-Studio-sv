import type { LanguageCode } from "@shared/storage/general-settings";
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

		await aiApplicationStorage.setAiApplications(aiApplicationState);
	}
}

export const aiApplicationService = new AiApplicationService();
