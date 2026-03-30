import { PLATFORM } from "@electron/main/constants/index";
import { app } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	classifyNetworkError,
	getCcApiImageTag,
	getDockerComposePath,
	getOpenClawConfigPath,
	getRuntimeComposeDir,
	getRuntimeComposePath,
	normalizeLinuxDistro,
} from "./local-vibe-utils";

vi.mock("electron", () => {
	let _isPackaged = false;
	return {
		app: {
			get isPackaged() {
				return _isPackaged;
			},
			set isPackaged(val: boolean) {
				_isPackaged = val;
			},
			getVersion: vi.fn(),
			getPath: vi.fn((name: string) => {
				if (name === "documents") return "/user/docs";
				if (name === "home") return "/user/home";
				return "/user/unknown";
			}),
		},
	};
});

vi.mock("@electron/main/constants/index", () => ({
	PLATFORM: {
		IS_MAC: false,
	},
}));

describe("local-vibe-utils", () => {
	let originalCwd: () => string;

	beforeEach(() => {
		originalCwd = process.cwd;
		process.cwd = () => "/project";
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-expect-error
		process.resourcesPath = "/app/res";
	});

	afterEach(() => {
		process.cwd = originalCwd;
		vi.resetAllMocks();
	});

	describe("getRuntimeComposeDir", () => {
		it("should return project path in development", () => {
			Object.defineProperty(app, "isPackaged", { value: false, writable: true });
			PLATFORM.IS_MAC = false;
			expect(getRuntimeComposeDir()).toBe("/project/ai302");
		});

		it("should return documents path on macOS when packaged", () => {
			Object.defineProperty(app, "isPackaged", { value: true, writable: true });
			PLATFORM.IS_MAC = true;
			expect(getRuntimeComposeDir()).toBe("/user/docs/ai302");
		});

		it("should return home path on non-macOS when packaged", () => {
			Object.defineProperty(app, "isPackaged", { value: true, writable: true });
			PLATFORM.IS_MAC = false;
			expect(getRuntimeComposeDir()).toBe("/user/home/ai302");
		});
	});

	describe("getDockerComposePath", () => {
		it("should return resources path when packaged", () => {
			Object.defineProperty(app, "isPackaged", { value: true, writable: true });
			expect(getDockerComposePath()).toBe("/app/res/docker-compose.yml");
		});

		it("should return static path in development", () => {
			Object.defineProperty(app, "isPackaged", { value: false, writable: true });
			expect(getDockerComposePath()).toBe("/project/static/docker-compose.yml");
		});
	});

	describe("getRuntimeComposePath", () => {
		it("should join directory with docker-compose.yml", () => {
			expect(getRuntimeComposePath("/dir")).toBe("/dir/docker-compose.yml");
		});
	});

	describe("getOpenClawConfigPath", () => {
		it("should return path to openclaw.json", () => {
			expect(getOpenClawConfigPath("/dir")).toBe("/dir/.openclaw/openclaw.json");
		});
	});

	describe("getCcApiImageTag", () => {
		it("should return 'dev' in development", () => {
			Object.defineProperty(app, "isPackaged", { value: false, writable: true });
			vi.mocked(app.getVersion).mockReturnValue("1.0.0");
			expect(getCcApiImageTag()).toBe("dev");
		});

		it("should return 'dev' for beta versions when packaged", () => {
			Object.defineProperty(app, "isPackaged", { value: true, writable: true });
			vi.mocked(app.getVersion).mockReturnValue("26.12.1-beta.4");
			expect(getCcApiImageTag()).toBe("dev");
		});

		it("should return 'main' for stable versions when packaged", () => {
			Object.defineProperty(app, "isPackaged", { value: true, writable: true });
			vi.mocked(app.getVersion).mockReturnValue("26.12.1");
			expect(getCcApiImageTag()).toBe("main");
		});
	});

	describe("normalizeLinuxDistro", () => {
		it("should identify Debian-based distros", () => {
			expect(normalizeLinuxDistro("debian")).toBe("debian");
			expect(normalizeLinuxDistro("ubuntu")).toBe("debian");
			expect(normalizeLinuxDistro("Pop")).toBe("debian");
		});

		it("should identify Arch-based distros", () => {
			expect(normalizeLinuxDistro("arch")).toBe("arch");
			expect(normalizeLinuxDistro("manjaro")).toBe("arch");
		});

		it("should identify RHEL-based distros", () => {
			expect(normalizeLinuxDistro("rhel")).toBe("rhel");
			expect(normalizeLinuxDistro("fedora")).toBe("rhel");
			expect(normalizeLinuxDistro("CentOS")).toBe("rhel");
		});

		it("should return unknown for others", () => {
			expect(normalizeLinuxDistro("gentoo")).toBe("unknown");
			expect(normalizeLinuxDistro("windows")).toBe("unknown");
		});
	});

	describe("classifyNetworkError", () => {
		it("should identify DNS errors", () => {
			const result = classifyNetworkError("getaddrinfo ENOTFOUND ghcr.io");
			expect(result.isNetworkError).toBe(true);
			expect(result.errorType).toBe("dns");
			expect(result.zhMessage).toContain("DNS");
		});

		it("should identify timeout errors", () => {
			const result = classifyNetworkError("connection timed out after 30s");
			expect(result.isNetworkError).toBe(true);
			expect(result.errorType).toBe("timeout");
		});

		it("should identify connection refused errors", () => {
			const result = classifyNetworkError("ECONNREFUSED 127.0.0.1:443");
			expect(result.isNetworkError).toBe(true);
			expect(result.errorType).toBe("connection_refused");
		});

		it("should identify proxy errors", () => {
			const result = classifyNetworkError("proxy error: 502 Bad Gateway");
			expect(result.isNetworkError).toBe(true);
			expect(result.errorType).toBe("proxy");
		});

		it("should return false for non-network errors", () => {
			const result = classifyNetworkError("file not found");
			expect(result.isNetworkError).toBe(false);
			expect(result.errorType).toBe("unknown");
		});
	});
});
