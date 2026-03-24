import { type } from "arktype";

export const openclawConfig = type({
	feishuSessionId: "string",
	telegramBotId: "string",
	agentId: "string",
});
export type OpenClawConfig = typeof openclawConfig.infer;
