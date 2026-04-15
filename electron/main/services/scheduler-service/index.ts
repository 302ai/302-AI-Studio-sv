import { createLogger } from "@shared/logger";
import { Cron } from "croner";

const logger = createLogger("services");

export const CRON_EXPRESSION = {
	/**
	 * Run every 5 seconds
	 */
	EVERY_5_SECONDS: "*/5 * * * * *",
	/**
	 * Run every 10 seconds
	 */
	EVERY_10_SECONDS: "*/10 * * * * *",
	/**
	 * Run every 15 seconds
	 */
	EVERY_15_SECONDS: "*/15 * * * * *",
	/**
	 * Run every 20 seconds
	 */
	EVERY_20_SECONDS: "*/20 * * * * *",
	/**
	 * Run every 30 seconds
	 */
	EVERY_30_SECONDS: "*/30 * * * * *",
	/**
	 * Run every 60 seconds (1 minute)
	 */
	EVERY_60_SECONDS: "*/60 * * * * *",
	/**
	 * Run every 5 minutes
	 */
	EVERY_5_MINUTES: "0 */5 * * * *",
} as const;

export class SchedulerService {
	private jobs = new Map<string, Cron>();

	addTask(
		name: string,
		cronExpression: string,
		callback: () => void | Promise<void>,
		timezone?: string,
	): boolean {
		// Stop and remove existing job with same name
		if (this.jobs.has(name)) {
			this.removeTask(name);
		}

		try {
			// Create and start new cron job
			const job = new Cron(
				cronExpression,
				{
					timezone,
				},
				async () => {
					try {
						await callback();
					} catch (error) {
						logger.error(`[Scheduler] Task "${name}" failed:`, error);
					}
				},
			);

			this.jobs.set(name, job);
			logger.info(`[Scheduler] Task "${name}" scheduled with expression: ${cronExpression}`);
			return true;
		} catch (error) {
			logger.error(`[Scheduler] Invalid cron expression: ${cronExpression}`, error);
			return false;
		}
	}

	removeTask(name: string): boolean {
		const job = this.jobs.get(name);
		if (!job) {
			return false;
		}

		job.stop();
		this.jobs.delete(name);
		logger.info(`[Scheduler] Task "${name}" removed`);
		return true;
	}

	getTaskNames(): string[] {
		return Array.from(this.jobs.keys());
	}

	hasTask(name: string): boolean {
		return this.jobs.has(name);
	}

	stopAll(): void {
		for (const [name, job] of this.jobs) {
			job.stop();
			logger.info(`[Scheduler] Task "${name}" stopped`);
		}
		this.jobs.clear();
	}
}

export const schedulerService = new SchedulerService();
