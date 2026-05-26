import { describe, expect, it } from "vitest";

import { get302AIBaseUrlWithoutV1 } from "./302ai-base-url";

describe("get302AIBaseUrlWithoutV1", () => {
	it("removes a trailing /v1 suffix for non-model 302.AI endpoints", () => {
		expect(get302AIBaseUrlWithoutV1("https://api.302ai.com/v1")).toBe("https://api.302ai.com");
	});

	it("removes a trailing /v1 suffix with a trailing slash", () => {
		expect(get302AIBaseUrlWithoutV1("https://api.302ai.com/v1/")).toBe("https://api.302ai.com");
	});

	it("does not add /v1 when the configured base URL does not include it", () => {
		expect(get302AIBaseUrlWithoutV1("https://proxy.example.com")).toBe(
			"https://proxy.example.com",
		);
	});
});
