import { createLogger } from "@shared/logger";

const logger = createLogger("services");

export type MemoryPressureLevel = "low" | "medium" | "high";

export interface MemorySnapshot {
	totalKB: number;
	freeKB: number;
	appWorkingSetKB: number;
	nowMs: number;
}

export interface MemoryPolicy {
	emaAlpha: number;
	freeRatioHigh: number;
	freeRatioMedium: number;
	workingSetHighKB: number;
	workingSetMediumKB: number;
	highIntervalMs: number;
	mediumIntervalMs: number;
	lowIntervalMs: number;
	lowIntervalMaxMs: number;
	lowStreakThreshold: number;
}

export interface MemoryState {
	emaFreeRatio: number;
	lastPressure: MemoryPressureLevel;
	lowStreak: number;
}

export interface MemoryEvaluationResult {
	pressure: MemoryPressureLevel;
	nextState: MemoryState;
	nextIntervalMs: number;
}

export interface MemoryChange {
	changed: boolean;
	changedPressure: boolean;
	changedInterval: boolean;
}

export interface MemoryManagerOptions {
	policy?: MemoryPolicy;
	initialState?: MemoryState;
	getSnapshot?: () => MemorySnapshot;
	setTimeoutFn?: typeof setTimeout;
	clearTimeoutFn?: typeof clearTimeout;
	immediateDelayMs?: number;
}

const KB_PER_MB = 1024;
const KB_PER_GB = KB_PER_MB * 1024;

export const DEFAULT_MEMORY_POLICY: MemoryPolicy = {
	emaAlpha: 0.3,
	freeRatioHigh: 0.12,
	freeRatioMedium: 0.2,
	workingSetHighKB: 4 * KB_PER_GB,
	workingSetMediumKB: 2 * KB_PER_GB,
	highIntervalMs: 30_000,
	mediumIntervalMs: 120_000,
	lowIntervalMs: 300_000,
	lowIntervalMaxMs: 600_000,
	lowStreakThreshold: 3,
};

export const DEFAULT_MEMORY_STATE: MemoryState = {
	emaFreeRatio: 1,
	lastPressure: "low",
	lowStreak: 0,
};

export function evaluateMemoryPressure(
	snapshot: MemorySnapshot,
	policy: MemoryPolicy,
	prevState?: MemoryState,
): MemoryEvaluationResult {
	const totalKB = snapshot.totalKB > 0 ? snapshot.totalKB : 0;
	const rawFreeRatio = totalKB > 0 ? snapshot.freeKB / totalKB : 0;
	const freeRatio = Math.min(1, Math.max(0, rawFreeRatio));

	const previousEma =
		prevState && Number.isFinite(prevState.emaFreeRatio) ? prevState.emaFreeRatio : freeRatio;
	const emaFreeRatio = policy.emaAlpha * freeRatio + (1 - policy.emaAlpha) * previousEma;

	const isHigh =
		emaFreeRatio < policy.freeRatioHigh || snapshot.appWorkingSetKB > policy.workingSetHighKB;
	const isMedium =
		emaFreeRatio < policy.freeRatioMedium ||
		snapshot.appWorkingSetKB > policy.workingSetMediumKB;

	const pressure: MemoryPressureLevel = isHigh ? "high" : isMedium ? "medium" : "low";
	const previousLowStreak = prevState?.lowStreak ?? 0;
	const lowStreak = pressure === "low" ? previousLowStreak + 1 : 0;

	let nextIntervalMs = policy.lowIntervalMs;
	if (pressure === "high") {
		nextIntervalMs = policy.highIntervalMs;
	} else if (pressure === "medium") {
		nextIntervalMs = policy.mediumIntervalMs;
	} else if (lowStreak < policy.lowStreakThreshold) {
		nextIntervalMs = policy.mediumIntervalMs;
	} else if (policy.lowIntervalMaxMs > policy.lowIntervalMs) {
		nextIntervalMs =
			lowStreak >= policy.lowStreakThreshold * 2
				? policy.lowIntervalMaxMs
				: policy.lowIntervalMs;
	}

	return {
		pressure,
		nextState: {
			emaFreeRatio,
			lastPressure: pressure,
			lowStreak,
		},
		nextIntervalMs,
	};
}

export function detectMemoryChange(
	prev: MemoryEvaluationResult | null,
	next: MemoryEvaluationResult,
): MemoryChange {
	if (!prev) {
		return { changed: true, changedPressure: true, changedInterval: true };
	}

	const changedPressure = prev.pressure !== next.pressure;
	const changedInterval = prev.nextIntervalMs !== next.nextIntervalMs;
	return {
		changed: changedPressure || changedInterval,
		changedPressure,
		changedInterval,
	};
}

const createDefaultSnapshot = (): MemorySnapshot => ({
	totalKB: 0,
	freeKB: 0,
	appWorkingSetKB: 0,
	nowMs: Date.now(),
});

export class MemoryManager {
	private readonly policy: MemoryPolicy;
	private readonly getSnapshot: () => MemorySnapshot;
	private readonly setTimeoutFn: typeof setTimeout;
	private readonly clearTimeoutFn: typeof clearTimeout;
	private readonly immediateDelayMs: number;
	private memoryState: MemoryState;
	private lastEvaluation: MemoryEvaluationResult | null;
	private timer: ReturnType<typeof setTimeout> | null;
	private immediateTimer: ReturnType<typeof setTimeout> | null;
	private isRunning: boolean;
	private isTickRunning: boolean;
	private onTick: (() => void | Promise<void>) | null;

	constructor(options: MemoryManagerOptions = {}) {
		this.policy = options.policy ?? DEFAULT_MEMORY_POLICY;
		this.memoryState = options.initialState
			? { ...options.initialState }
			: { ...DEFAULT_MEMORY_STATE };
		this.getSnapshot = options.getSnapshot ?? createDefaultSnapshot;
		this.setTimeoutFn = options.setTimeoutFn ?? setTimeout;
		this.clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
		this.immediateDelayMs = options.immediateDelayMs ?? 1000;
		this.lastEvaluation = null;
		this.timer = null;
		this.immediateTimer = null;
		this.isRunning = false;
		this.isTickRunning = false;
		this.onTick = null;
	}

	start(onTick: () => void | Promise<void>) {
		this.stop();
		this.isRunning = true;
		this.onTick = onTick;

		const snapshot = this.getSnapshot();
		const evaluation = evaluateMemoryPressure(snapshot, this.policy, this.memoryState);
		const change = detectMemoryChange(this.lastEvaluation, evaluation);

		if (change.changed) {
			this.logMemoryChange(change, snapshot, evaluation);
		}

		this.memoryState = evaluation.nextState;
		this.lastEvaluation = evaluation;
		this.scheduleNext(evaluation.nextIntervalMs);
	}

	stop() {
		this.isRunning = false;
		this.onTick = null;
		if (this.timer) {
			this.clearTimeoutFn(this.timer);
			this.timer = null;
		}
		if (this.immediateTimer) {
			this.clearTimeoutFn(this.immediateTimer);
			this.immediateTimer = null;
		}
	}

	requestImmediateCheck() {
		if (!this.isRunning || this.isTickRunning) return;
		if (this.immediateTimer) return;

		this.immediateTimer = this.setTimeoutFn(() => {
			this.immediateTimer = null;
			void this.runCycle();
		}, this.immediateDelayMs);
	}

	private scheduleNext(intervalMs: number) {
		if (!this.isRunning) return;

		if (this.timer) {
			this.clearTimeoutFn(this.timer);
		}

		this.timer = this.setTimeoutFn(() => {
			void this.runCycle();
		}, intervalMs);
	}

	private async runCycle() {
		if (!this.isRunning || this.isTickRunning) return;
		this.isTickRunning = true;

		try {
			if (this.onTick) {
				try {
					await this.onTick();
				} catch (error) {
					logger.error("onTick failed:", error);
				}
			}
		} finally {
			this.isTickRunning = false;
		}

		if (!this.isRunning) return;

		const snapshot = this.getSnapshot();
		const evaluation = evaluateMemoryPressure(snapshot, this.policy, this.memoryState);
		const change = detectMemoryChange(this.lastEvaluation, evaluation);

		if (change.changed) {
			this.logMemoryChange(change, snapshot, evaluation);
		}

		this.memoryState = evaluation.nextState;
		this.lastEvaluation = evaluation;
		this.scheduleNext(evaluation.nextIntervalMs);
	}

	private logMemoryChange(
		change: MemoryChange,
		snapshot: MemorySnapshot,
		evaluation: MemoryEvaluationResult,
	) {
		const previous = this.lastEvaluation;
		const freeRatio = snapshot.totalKB > 0 ? snapshot.freeKB / snapshot.totalKB : 0;
		const freePercent = (freeRatio * 100).toFixed(1);
		const appWorkingSetMB = Math.round(snapshot.appWorkingSetKB / 1024);
		const previousInterval = previous ? `${previous.nextIntervalMs}ms` : "n/a";
		const changeReasons = [
			change.changedPressure ? "pressure" : null,
			change.changedInterval ? "interval" : null,
		].filter(Boolean);
		const reasonLabel = changeReasons.length > 0 ? changeReasons.join("+") : "unknown";

		logger.info(
			`[MemoryManager] Policy change (${reasonLabel}): pressure ${
				previous?.pressure ?? "none"
			} -> ${evaluation.pressure}, interval ${previousInterval} -> ${
				evaluation.nextIntervalMs
			}ms, free ${freePercent}%, appWS ${appWorkingSetMB}MB`,
		);
	}
}
