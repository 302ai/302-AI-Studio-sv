import { type } from "arktype";
import ky from "ky";

const ai302UserInfoSchema = type({
	data: {
		uid: "number",
		user_name: "string",
		email: "string",
	},
});

type Ai302UserInfo = typeof ai302UserInfoSchema.infer;

/**
 * Fetch 302.AI user info
 * @param apiKey - The API key for the 302.AI user
 * @returns The 302.AI user info
 */
export async function fetch302AIUserInfo(apiKey: string): Promise<Ai302UserInfo> {
	try {
		const response = await ky
			.get("https://dash-api.302.ai/user/info", {
				headers: {
					Authorization: `Bearer ${apiKey}`,
				},
			})
			.json();

		const validated = ai302UserInfoSchema(response);
		if (validated instanceof type.errors) {
			console.error("Failed to validate 302.AI user info:", validated.summary);
			throw new Error("Invalid response format from 302.AI user info API");
		}

		return validated;
	} catch (error) {
		console.error("Failed to fetch 302.AI user info:", error);
		throw new Error("Failed to fetch 302.AI user info");
	}
}

const ai302ToolListSchema = type({
	data: {
		data: [
			{
				tool_id: "number",
				tool_name: "string",
				tool_description: "string",
				enable: "boolean",
				category_name: "string",
				category_id: "number",
			},
			"[]",
		],
	},
});

type Ai302ToolsList = typeof ai302ToolListSchema.infer;

export async function fetch302AIToolList(
	lang: "cn" | "en" | "jp",
): Promise<Ai302ToolsList["data"]["data"]> {
	try {
		const response = await ky
			.get("https://dash-api.302.ai/gpt/api/tool/list", {
				headers: {
					Lang: lang,
				},
			})
			.json();

		const validated = ai302ToolListSchema(response);
		if (validated instanceof type.errors) {
			console.error("Failed to validate 302.AI tools list:", validated.summary);
			throw new Error("Invalid response format from 302.AI tools list API");
		}

		const drawingRobotData = {
			tool_id: -1,
			tool_name: lang === "cn" ? "绘画机器人" : lang === "jp" ? "描画ロボット" : "Drawing Robot",
			tool_description:
				lang === "cn"
					? "支持Midjourney、Flux、SD、Ideogram、Recraft"
					: lang === "jp"
						? "Midjourney、Flux、SD、Ideogram、Recraftをサポート"
						: "Supports Midjourney, Flux, SD, Ideogram, Recraft",
			enable: true,
			category_name: lang === "cn" ? "图片处理" : lang === "jp" ? "画像処理" : "Image Processing",
			category_id: 4,
		};
		const tools = [drawingRobotData, ...validated.data.data];

		return tools;
	} catch (error) {
		console.error("Failed to fetch 302.AI tools list:", error);
		throw new Error("Failed to fetch 302.AI tools list");
	}
}

const ai302ToolDetailSchema = type({
	data: {
		app_box_detail: {
			"[string]": {
				"api_key?": "string",
				url: "string",
			},
		},
	},
});

type Ai302ToolDetail = typeof ai302ToolDetailSchema.infer;

export async function fetch302AIToolDetail(uidBase64: string): Promise<Ai302ToolDetail> {
	try {
		const response = await ky
			.get("https://dash-api.302.ai/gpt/api/v1/code", {
				headers: {
					uid: uidBase64,
				},
			})
			.json();

		const validated = ai302ToolDetailSchema(response);
		if (validated instanceof type.errors) {
			console.error("Failed to validate 302.AI tool detail:", validated.summary);
			throw new Error("Invalid response format from 302.AI tool detail API");
		}

		return validated;
	} catch (error) {
		console.error("Failed to fetch 302.AI tool detail:", error);
		throw new Error("Failed to fetch 302.AI tool detail");
	}
}
