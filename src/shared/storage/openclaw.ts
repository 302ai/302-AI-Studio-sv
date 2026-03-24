import { type } from "arktype";

export const openclawConfig = type({
	feishuSessionId: "string",
	telegramSessionId: "string",
	agentId: "string",
});
export type OpenClawConfig = typeof openclawConfig.infer;
