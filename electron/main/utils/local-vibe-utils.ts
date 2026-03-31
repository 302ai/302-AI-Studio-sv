import { PLATFORM } from "@electron/main/constants/index";
import { app } from "electron";
import path from "path";
import process from "process";
import semver from "semver";
import { match } from "ts-pattern";
import { isChineseLocale } from "./local";

/**
 * Get the runtime compose directory
 */
export function getRuntimeComposeDir(): string {
	return match(app.isPackaged)
		.with(true, () =>
			match(PLATFORM.IS_MAC)
				.with(true, () => path.join(app.getPath("documents"), "ai302"))
				.otherwise(() => path.join(app.getPath("home"), "ai302")),
		)
		.otherwise(() => path.join(process.cwd(), "ai302"));
}

/**
 * Get the path to docker-compose.yml template
 */
export function getDockerComposePath(): string {
	if (app.isPackaged) {
		return path.join(process.resourcesPath, "docker-compose.yml");
	}
	return path.join(process.cwd(), "static", "docker-compose.yml");
}

/**
 * Get the runtime compose file path
 */
export function getRuntimeComposePath(runtimeComposeDir: string): string {
	return path.join(runtimeComposeDir, "docker-compose.yml");
}

/**
 * Get the path to openclaw.json
 */
export function getOpenClawConfigPath(runtimeComposeDir: string): string {
	return path.join(runtimeComposeDir, ".openclaw", "openclaw.json");
}

/**
 * Get the runtime cc-local-api image tag based on app version and environment
 */
export function getCcApiImageTag(): "dev" | "main" {
	return match(app.isPackaged)
		.with(false, () => "dev" as const)
		.with(true, () => {
			const version = app.getVersion();
			const prerelease = semver.prerelease(version);
			const isBeta = Array.isArray(prerelease) && prerelease[0] === "beta";
			return (isBeta ? "dev" : "main") as "dev" | "main";
		})
		.exhaustive();
}

/**
 * Get the full runtime cc-local-api image path
 */
export async function getCcApiImage(): Promise<string> {
	const tag = getCcApiImageTag();
	const image = (await isChineseLocale())
		? `302-registry.cn-guangzhou.cr.aliyuncs.com/302ai/local_agent:${tag}`
		: `ghcr.io/302ai/cc-local-api:${tag}`;

	return image;
}

/**
 * Normalizes a Linux distribution ID or ID_LIKE string into one of the main families
 */
export function normalizeLinuxDistro(id: string): "debian" | "arch" | "rhel" | "unknown" {
	const debianDistros = [
		"debian",
		"ubuntu",
		"linuxmint",
		"pop",
		"mx",
		"elementary",
		"deepin",
		"kali",
		"steamos",
		"kde-neon",
	];

	const archDistros = ["arch", "manjaro", "endeavouros", "arco", "rebornos", "artix"];

	const rhelDistros = ["rhel", "centos", "almalinux", "rocky", "fedora", "ol"];

	const lowerId = id.toLowerCase();

	if (debianDistros.includes(lowerId)) {
		return "debian";
	}
	if (archDistros.includes(lowerId)) {
		return "arch";
	}
	if (rhelDistros.includes(lowerId)) {
		return "rhel";
	}

	return "unknown";
}

/**
 * Error types for network classification
 */
export type NetworkErrorType = "dns" | "timeout" | "connection_refused" | "proxy" | "unknown";

/**
 * Classification result for network errors
 */
export interface NetworkErrorClassification {
	isNetworkError: boolean;
	errorType: NetworkErrorType;
	zhMessage: string;
	enMessage: string;
}

/**
 * Checks if an error is network-related and provides localized messages
 */
export function classifyNetworkError(errorMessage: string): NetworkErrorClassification {
	const lowerMsg = errorMessage.toLowerCase();

	// DNS resolution errors
	if (
		lowerMsg.includes("no such host") ||
		lowerMsg.includes("lookup") ||
		lowerMsg.includes("resolve") ||
		lowerMsg.includes("nxdomain") ||
		lowerMsg.includes("enotfound")
	) {
		return {
			isNetworkError: true,
			errorType: "dns",
			zhMessage: "无法解析容器镜像仓库地址，请检查网络连接和 DNS 设置",
			enMessage:
				"Cannot resolve container registry address. Please check your network connection and DNS settings.",
		};
	}

	// Connection timeout
	if (
		lowerMsg.includes("timeout") ||
		lowerMsg.includes("timed out") ||
		lowerMsg.includes("deadline exceeded")
	) {
		return {
			isNetworkError: true,
			errorType: "timeout",
			zhMessage: "连接容器镜像仓库超时，请检查网络连接或稍后重试",
			enMessage:
				"Connection to container registry timed out. Please check your network or try again later.",
		};
	}

	// Connection refused
	if (lowerMsg.includes("connection refused") || lowerMsg.includes("refused")) {
		return {
			isNetworkError: true,
			errorType: "connection_refused",
			zhMessage: "连接被拒绝，可能是防火墙或代理设置问题",
			enMessage: "Connection refused. This may be due to firewall or proxy settings.",
		};
	}

	// Proxy errors
	if (lowerMsg.includes("proxy") || lowerMsg.includes("tunnel")) {
		return {
			isNetworkError: true,
			errorType: "proxy",
			zhMessage: "代理服务器错误，请检查代理设置",
			enMessage: "Proxy server error. Please check your proxy settings.",
		};
	}

	return {
		isNetworkError: false,
		errorType: "unknown",
		zhMessage: "",
		enMessage: "",
	};
}
