import { afterEach, describe, expect, it, vi } from "vitest";

const { loggerInfoMock } = vi.hoisted(() => ({
	loggerInfoMock: vi.fn(),
}));

vi.mock("@shared/logger", () => ({
	createLogger: () => ({ info: loggerInfoMock, error: vi.fn() }),
}));

import {
	DEFAULT_MEMORY_POLICY,
	DEFAULT_MEMORY_STATE,
	detectMemoryChange,
	evaluateMemoryPressure,
	MemoryManager,
	type MemoryEvaluationResult,
	type MemorySnapshot,
} from "./memory-manager";

const makeSnapshot = (overrides: Partial<MemorySnapshot> = {}): MemorySnapshot => ({
	totalKB: 1_000_000,
	freeKB: 300_000,
	appWorkingSetKB: 200_000,
	nowMs: 0,
	...overrides,
});

const makeEvaluation = (
	overrides: Partial<MemoryEvaluationResult> = {},
): MemoryEvaluationResult => ({
	pressure: "low",
	nextIntervalMs: 1000,
	nextState: { ...DEFAULT_MEMORY_STATE },
	...overrides,
});

const KB_PER_GB = 1024 * 1024;

describe("memory-manager", () => {
	it("uses 4GiB/2GiB defaults for working set thresholds", () => {
		expect(DEFAULT_MEMORY_POLICY.workingSetHighKB).toBe(4 * KB_PER_GB);
		expect(DEFAULT_MEMORY_POLICY.workingSetMediumKB).toBe(2 * KB_PER_GB);
	});

	it("returns high pressure when free ratio drops below high threshold", () => {
		const snapshot = makeSnapshot({ totalKB: 1_000_000, freeKB: 50_000 });
		const result = evaluateMemoryPressure(snapshot, DEFAULT_MEMORY_POLICY);

		expect(result.pressure).toBe("high");
		expect(result.nextIntervalMs).toBe(DEFAULT_MEMORY_POLICY.highIntervalMs);
	});

	it("returns medium pressure when working set exceeds medium threshold", () => {
		const snapshot = makeSnapshot({
			freeKB: 500_000,
			appWorkingSetKB: DEFAULT_MEMORY_POLICY.workingSetMediumKB + 1,
		});
		const result = evaluateMemoryPressure(snapshot, DEFAULT_MEMORY_POLICY);

		expect(result.pressure).toBe("medium");
		expect(result.nextIntervalMs).toBe(DEFAULT_MEMORY_POLICY.mediumIntervalMs);
	});

	it("uses medium interval until low streak reaches threshold", () => {
		const snapshot = makeSnapshot({ freeKB: 800_000, appWorkingSetKB: 50_000 });
		const policy = { ...DEFAULT_MEMORY_POLICY, lowStreakThreshold: 2 };

		const first = evaluateMemoryPressure(snapshot, policy);
		expect(first.pressure).toBe("low");
		expect(first.nextIntervalMs).toBe(policy.mediumIntervalMs);

		const second = evaluateMemoryPressure(snapshot, policy, first.nextState);
		expect(second.pressure).toBe("low");
		expect(second.nextIntervalMs).toBe(policy.lowIntervalMs);
	});

	it("resets low streak when pressure rises", () => {
		const lowSnapshot = makeSnapshot({ freeKB: 800_000 });
		const highSnapshot = makeSnapshot({
			freeKB: 50_000,
			appWorkingSetKB: DEFAULT_MEMORY_POLICY.workingSetHighKB + 1,
		});
		const policy = { ...DEFAULT_MEMORY_POLICY, lowStreakThreshold: 3 };

		const first = evaluateMemoryPressure(lowSnapshot, policy);
		const second = evaluateMemoryPressure(lowSnapshot, policy, first.nextState);
		const third = evaluateMemoryPressure(highSnapshot, policy, second.nextState);

		expect(third.pressure).toBe("high");
		expect(third.nextState.lowStreak).toBe(0);
	});

	it("detects change when pressure changes", () => {
		const prev = makeEvaluation({ pressure: "low", nextIntervalMs: 1000 });
		const next = makeEvaluation({ pressure: "high", nextIntervalMs: 1000 });
		const change = detectMemoryChange(prev, next);

		expect(change.changed).toBe(true);
		expect(change.changedPressure).toBe(true);
		expect(change.changedInterval).toBe(false);
	});

	it("detects change when interval changes", () => {
		const prev = makeEvaluation({ pressure: "low", nextIntervalMs: 1000 });
		const next = makeEvaluation({ pressure: "low", nextIntervalMs: 2000 });
		const change = detectMemoryChange(prev, next);

		expect(change.changed).toBe(true);
		expect(change.changedPressure).toBe(false);
		expect(change.changedInterval).toBe(true);
	});

	it("treats missing previous evaluation as a change", () => {
		const next = makeEvaluation({ pressure: "medium", nextIntervalMs: 2000 });
		const change = detectMemoryChange(null, next);

		expect(change.changed).toBe(true);
		expect(change.changedPressure).toBe(true);
		expect(change.changedInterval).toBe(true);
	});

	it("returns no change when pressure and interval stay the same", () => {
		const prev = makeEvaluation({ pressure: "low", nextIntervalMs: 1000 });
		const next = makeEvaluation({ pressure: "low", nextIntervalMs: 1000 });
		const change = detectMemoryChange(prev, next);

		expect(change.changed).toBe(false);
		expect(change.changedPressure).toBe(false);
		expect(change.changedInterval).toBe(false);
	});

	describe("MemoryManager", () => {
		afterEach(() => {
			vi.useRealTimers();
			loggerInfoMock.mockClear();
		});

		it("schedules onTick based on evaluation interval and logs changes", async () => {
			vi.useFakeTimers();
			const onTick = vi.fn();
			const policy = {
				...DEFAULT_MEMORY_POLICY,
				emaAlpha: 1,
				highIntervalMs: 1000,
				mediumIntervalMs: 2000,
				lowIntervalMs: 3000,
				lowStreakThreshold: 1,
			};
			const snapshots = [
				makeSnapshot({ totalKB: 1000, freeKB: 50 }), // high
				makeSnapshot({ totalKB: 1000, freeKB: 800 }), // low
			];
			const getSnapshot = vi.fn(() => snapshots.shift() ?? makeSnapshot());
			const manager = new MemoryManager({ policy, getSnapshot });

			manager.start(onTick);

			expect(loggerInfoMock).toHaveBeenCalledTimes(1);
			expect(onTick).not.toHaveBeenCalled();

			await vi.advanceTimersByTimeAsync(1000);

			expect(onTick).toHaveBeenCalledTimes(1);
			expect(loggerInfoMock).toHaveBeenCalledTimes(2);
		});

		it("stop prevents further ticks", async () => {
			vi.useFakeTimers();
			const onTick = vi.fn();
			const policy = {
				...DEFAULT_MEMORY_POLICY,
				emaAlpha: 1,
				highIntervalMs: 500,
			};
			const getSnapshot = vi.fn(() => makeSnapshot({ totalKB: 1000, freeKB: 50 }));
			const manager = new MemoryManager({ policy, getSnapshot });

			manager.start(onTick);
			manager.stop();

			await vi.advanceTimersByTimeAsync(500);

			expect(onTick).not.toHaveBeenCalled();
		});

		it("requestImmediateCheck triggers onTick sooner than scheduled interval", async () => {
			vi.useFakeTimers();
			const onTick = vi.fn();
			const policy = {
				...DEFAULT_MEMORY_POLICY,
				emaAlpha: 1,
				highIntervalMs: 5000,
			};
			const getSnapshot = vi.fn(() => makeSnapshot({ totalKB: 1000, freeKB: 50 }));
			const manager = new MemoryManager({ policy, getSnapshot });

			manager.start(onTick);
			manager.requestImmediateCheck();

			await vi.advanceTimersByTimeAsync(1000);

			expect(onTick).toHaveBeenCalledTimes(1);
		});
	});
});
