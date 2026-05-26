import type { CodeAgentGlobalConfigs } from "@shared/storage/code-agent";
import { describe, expect, it } from "vitest";
import { createInitialCodeAgentConfig } from "./code-agent-config-utils";

const baseGlobalConfigs: CodeAgentGlobalConfigs = {
	apiKey: "",
	autoDeploy: true,
	autoFixDeployFailure: true,
	notificationsEnabled: false,
	lastVibeMode: "local",
	lastAgentId: "claude-code",
	lastSessionMode: "chat",
	feishu: { appId: "", appSecret: "" },
	dingtalk: { clientId: "", clientSecret: "" },
	qqbot: { appId: "", clientSecret: "" },
	wecom: { botId: "", secret: "" },
	telegram: { accounts: { default: { botToken: "" } } },
	discord: { token: "" },
};

describe("createInitialCodeAgentConfig", () => {
	it("uses the last OpenClaw agent for new local Vibe sessions", () => {
		const config = createInitialCodeAgentConfig("thread-1", {
			...baseGlobalConfigs,
			lastSessionMode: "vibe",
			lastVibeMode: "local",
			lastAgentId: "open-claw",
		});

		expect(config).toMatchObject({
			enabled: true,
			threadId: "thread-1",
			type: "local",
			currentAgentId: "open-claw",
			codingAgentId: "claude-code",
		});
	});

	it("keeps remote Vibe sessions on Claude Code because remote does not support OpenClaw", () => {
		const config = createInitialCodeAgentConfig("thread-2", {
			...baseGlobalConfigs,
			lastSessionMode: "vibe",
			lastVibeMode: "remote",
			lastAgentId: "open-claw",
		});

		expect(config).toMatchObject({
			enabled: true,
			type: "remote",
			currentAgentId: "claude-code",
			codingAgentId: "claude-code",
		});
	});

	it("uses chat mode defaults when the last session mode is chat", () => {
		const config = createInitialCodeAgentConfig("thread-3", {
			...baseGlobalConfigs,
			lastSessionMode: "chat",
			lastVibeMode: "cloud",
			lastAgentId: "open-claw",
		});

		expect(config).toMatchObject({
			enabled: false,
			type: "remote",
			currentAgentId: "claude-code",
			codingAgentId: "claude-code",
		});
	});
});
