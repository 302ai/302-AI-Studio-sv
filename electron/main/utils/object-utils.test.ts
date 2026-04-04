import { get } from "es-toolkit/compat";
import { describe, expect, it } from "vitest";
import { deepMergeWithOverride, mergeArrays, omitByPrefix, shouldOverride } from "./object-utils";

// ─── shouldOverride ───────────────────────────────────────────────────────────

describe("shouldOverride", () => {
	it("returns false for empty overridePaths", () => {
		expect(shouldOverride("a.b.c", [])).toBe(false);
	});

	it("matches exact path", () => {
		expect(shouldOverride("a.b", ["a.b"])).toBe(true);
	});

	it("matches child path when parent is listed", () => {
		expect(shouldOverride("a.b.c", ["a.b"])).toBe(true);
		expect(shouldOverride("a.b.c.d", ["a.b"])).toBe(true);
	});

	it("does not match parent path when child is listed", () => {
		// Listing "a.b.c" does NOT cause "a.b" to be overridden
		expect(shouldOverride("a.b", ["a.b.c"])).toBe(false);
	});

	it("does not match unrelated paths", () => {
		expect(shouldOverride("x.y", ["a.b"])).toBe(false);
	});

	it("does not match partial prefix (no false positive on shared prefix)", () => {
		// "a.bc" should NOT match override "a.b" — it's not a child, just a similar prefix
		expect(shouldOverride("a.bc", ["a.b"])).toBe(false);
	});

	it("matches against multiple override paths", () => {
		expect(shouldOverride("x.y", ["a.b", "x.y", "c.d"])).toBe(true);
	});
});

// ─── mergeArrays ──────────────────────────────────────────────────────────────

describe("mergeArrays", () => {
	it("returns source when target is empty", () => {
		expect(mergeArrays([], [1, 2, 3])).toEqual([1, 2, 3]);
	});

	it("returns target when source is empty", () => {
		expect(mergeArrays([1, 2], [])).toEqual([1, 2]);
	});

	it("deduplicates primitives via Set", () => {
		expect(mergeArrays([1, 2, 3], [3, 4, 5])).toEqual([1, 2, 3, 4, 5]);
	});

	it("deduplicates strings", () => {
		expect(mergeArrays(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
	});

	it("uses identity function for object dedup", () => {
		const target = [
			{ id: "m1", name: "Model A" },
			{ id: "m2", name: "Model B" },
		];
		const source = [
			{ id: "m2", name: "Model B Updated" },
			{ id: "m3", name: "Model C" },
		];
		const result = mergeArrays(target, source, (item) => item.id);
		expect(result).toEqual([
			{ id: "m1", name: "Model A" },
			{ id: "m2", name: "Model B" }, // keeps target's version
			{ id: "m3", name: "Model C" }, // added from source
		]);
	});

	it("returns source if target is not an array", () => {
		expect(mergeArrays("not-array" as unknown as number[], [1, 2])).toEqual([1, 2]);
	});
});

// ─── deepMergeWithOverride ────────────────────────────────────────────────────

describe("deepMergeWithOverride", () => {
	it("adds missing keys from source", () => {
		const target = { a: 1 };
		const source = { b: 2 };
		const result = deepMergeWithOverride(target, source);
		expect(result).toEqual({ a: 1, b: 2 });
	});

	it("preserves existing primitive values (user config wins)", () => {
		const target = { a: "user-value" };
		const source = { a: "template-value" };
		const result = deepMergeWithOverride(target, source);
		expect(result.a).toBe("user-value");
	});

	it("recursively merges nested objects", () => {
		const target = { nested: { a: 1 } };
		const source = { nested: { b: 2 } };
		const result = deepMergeWithOverride(target, source);
		expect(result).toEqual({ nested: { a: 1, b: 2 } });
	});

	it("deep merges multiple levels", () => {
		const target = { l1: { l2: { a: "user" } } };
		const source = { l1: { l2: { b: "template" }, l2b: { c: 3 } } };
		const result = deepMergeWithOverride(target, source);
		expect(result).toEqual({
			l1: { l2: { a: "user", b: "template" }, l2b: { c: 3 } },
		});
	});

	it("merges arrays with deduplication (primitives)", () => {
		const target = { tags: ["a", "b"] };
		const source = { tags: ["b", "c"] };
		const result = deepMergeWithOverride(target, source);
		expect(result.tags).toEqual(["a", "b", "c"]);
	});

	it("merges object arrays by id field", () => {
		const target = { models: [{ id: "m1", name: "A" }] };
		const source = {
			models: [
				{ id: "m1", name: "A-updated" },
				{ id: "m2", name: "B" },
			],
		};
		const result = deepMergeWithOverride(target, source);
		expect(result.models).toEqual([
			{ id: "m1", name: "A" }, // target wins for existing
			{ id: "m2", name: "B" }, // new item added
		]);
	});

	// ─── overridePaths ────────────────────────────────────────────────────────

	it("force-overrides exact path", () => {
		const target = { settings: { port: 8080 } };
		const source = { settings: { port: 9090 } };
		const result = deepMergeWithOverride(target, source, ["settings.port"]);
		expect(get(result, "settings.port")).toBe(9090);
	});

	it("force-overrides child paths when parent is listed", () => {
		const target = {
			gateway: {
				auth: { mode: "user-mode", token: "user-token" },
				port: 3000,
			},
		};
		const source = {
			gateway: {
				auth: { mode: "template-mode", token: "template-token" },
				port: 9000,
			},
		};
		const result = deepMergeWithOverride(target, source, ["gateway.auth"]);
		// auth subtree should be overridden
		expect(get(result, "gateway.auth")).toEqual({
			mode: "template-mode",
			token: "template-token",
		});
		// port should NOT be overridden (not in overridePaths)
		expect(get(result, "gateway.port")).toBe(3000);
	});

	it("force-overrides only a deep leaf field", () => {
		const target: Record<string, unknown> = {
			models: {
				providers: {
					ai302: { baseUrl: "user-url", apiKey: "user-key" },
				},
			},
		};
		const source: Record<string, unknown> = {
			models: {
				providers: {
					ai302: { baseUrl: "template-url", apiKey: "new-key" },
				},
			},
		};
		const result = deepMergeWithOverride(target, source, ["models.providers.ai302.apiKey"]);
		// Use get() to access deep paths — same pattern as the production code
		expect(get(result, "models.providers.ai302.apiKey")).toBe("new-key");
		// baseUrl should be preserved (user config wins)
		expect(get(result, "models.providers.ai302.baseUrl")).toBe("user-url");
	});

	it("does not mutate source object", () => {
		const target = { a: 1 };
		const source = { b: { nested: 2 } };
		const sourceCopy = JSON.parse(JSON.stringify(source));
		deepMergeWithOverride(target, source);
		expect(source).toEqual(sourceCopy);
	});

	it("clones source values into target (no shared references)", () => {
		const nestedObj = { deep: true };
		const source = { added: nestedObj };
		const target: Record<string, unknown> = {};
		deepMergeWithOverride(target, source);
		// Modifying the source's nested object should not affect the merged target
		nestedObj.deep = false;
		expect((target.added as { deep: boolean }).deep).toBe(true);
	});

	// ─── realistic openclaw-like scenario ─────────────────────────────────────

	it("handles realistic openclaw config merge", () => {
		const existing = {
			models: {
				providers: {
					ai302: {
						baseUrl: "https://custom.example.com/v1",
						apiKey: "old-key-123",
					},
				},
			},
			gateway: { port: 18789, mode: "local" },
			skills: { entries: { "302ai-search": { enabled: true, apiKey: "old-key-123" } } },
		};

		const template = {
			models: {
				providers: {
					ai302: {
						baseUrl: "https://api.302.ai/v1",
						apiKey: "new-key-456",
					},
					"ai302-coding": {
						baseUrl: "https://api.302.ai/v1",
						apiKey: "new-key-456",
					},
				},
			},
			gateway: { port: 18789, mode: "local", bind: "loopback" },
			skills: { entries: { "302ai-search": { enabled: true, apiKey: "new-key-456" } } },
		};

		const overridePaths = [
			"models.providers.ai302.apiKey",
			"models.providers.ai302-coding.apiKey",
			"skills.entries.302ai-search.apiKey",
		];

		const result = deepMergeWithOverride(existing, template, overridePaths);

		// API keys: overridden to new value
		expect(get(result, "models.providers.ai302.apiKey")).toBe("new-key-456");
		expect(get(result, "models.providers.ai302-coding.apiKey")).toBe("new-key-456");
		expect(get(result, "skills.entries.302ai-search.apiKey")).toBe("new-key-456");

		// baseUrl: user value preserved (not in overridePaths)
		expect(get(result, "models.providers.ai302.baseUrl")).toBe("https://custom.example.com/v1");

		// New provider added from template
		expect(get(result, "models.providers.ai302-coding.baseUrl")).toBe("https://api.302.ai/v1");

		// New field "bind" added from template
		expect(get(result, "gateway.bind")).toBe("loopback");

		// Existing field "port" preserved
		expect(get(result, "gateway.port")).toBe(18789);
	});
});

// ─── omitByPrefix ─────────────────────────────────────────────────────────────

describe("omitByPrefix", () => {
	it("removes keys matching a single prefix", () => {
		const obj = { "ai302/model-a": {}, "ai302/model-b": {}, "other/model": {} };
		expect(omitByPrefix(obj, ["ai302/"])).toEqual({ "other/model": {} });
	});

	it("removes keys matching multiple prefixes", () => {
		const obj = {
			"ai302/a": {},
			"ai302-coding/b": {},
			"custom/c": {},
		};
		expect(omitByPrefix(obj, ["ai302/", "ai302-coding/"])).toEqual({ "custom/c": {} });
	});

	it("returns all keys when no prefix matches", () => {
		const obj = { a: 1, b: 2 };
		expect(omitByPrefix(obj, ["z"])).toEqual({ a: 1, b: 2 });
	});

	it("returns empty object when all keys match", () => {
		const obj = { "pre-a": 1, "pre-b": 2 };
		expect(omitByPrefix(obj, ["pre-"])).toEqual({});
	});
});
