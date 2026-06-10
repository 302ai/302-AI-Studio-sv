import { describe, expect, it } from "vitest";

import { DeployRetryState } from "./deploy-retry-state";

describe("DeployRetryState", () => {
	it("allows retry again and clears stale API error after manual reset", () => {
		const state = new DeployRetryState(3);

		state.recordApiError("old deploy error");
		state.incrementRetry();
		state.incrementRetry();
		state.incrementRetry();

		expect(state.canRetry()).toBe(false);

		state.reset();

		expect(state.canRetry()).toBe(true);
		expect(state.consumeApiError()).toBeNull();
	});
});
