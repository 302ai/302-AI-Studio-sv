import type { ModelProvider } from "@shared/types";
import { describe, expect, it } from "vitest";
import { normalizeProviderList } from "./provider-storage-utils";

const makeProvider = (overrides: Partial<ModelProvider> = {}): ModelProvider => ({
	id: "302AI",
	name: "302.AI",
	apiType: "302ai",
	apiKey: "sk-test",
	baseUrl: "https://api.302.ai/v1",
	enabled: true,
	custom: false,
	status: "connected",
	websites: {
		official: "",
		apiKey: "",
		docs: "",
		models: "",
		defaultBaseUrl: "",
	},
	...overrides,
});

describe("normalizeProviderList", () => {
	it("keeps provider arrays as arrays", () => {
		const providers = [makeProvider()];

		expect(Array.isArray(normalizeProviderList(providers))).toBe(true);
	});

	it("converts object-form provider storage to an array", () => {
		const providers = normalizeProviderList({ 0: makeProvider(), _version: 1 });

		expect(providers).toHaveLength(1);
		expect(providers[0].apiType).toBe("302ai");
	});

	it("normalizes legacy 302.ai API base URL", () => {
		const providers = normalizeProviderList([makeProvider()]);

		expect(providers[0].baseUrl).toBe("https://api.302ai.com/v1");
	});

	it("returns an empty array for invalid storage values", () => {
		expect(normalizeProviderList(null)).toEqual([]);
		expect(normalizeProviderList("invalid")).toEqual([]);
	});
});
