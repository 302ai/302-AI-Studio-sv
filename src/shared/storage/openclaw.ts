import { type } from "arktype";

export const openclawBindingKeys = ["feishuSessionId", "telegramBotId"] as const;
export type OpenClawBindingKey = (typeof openclawBindingKeys)[number];

export const openclawConfig = type({
	feishuSessionId: "string",
	telegramBotId: "string",
	agentId: "string",
});
export type OpenClawConfig = typeof openclawConfig.infer;
