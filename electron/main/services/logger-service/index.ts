/* eslint-disable @typescript-eslint/no-explicit-any */
import { isDev } from "@electron/main/constants";
import type { LogCategory, LogLevel } from "@shared/logger/types";
import archiver from "archiver";
import type { IpcMainInvokeEvent } from "electron";
import { app, dialog } from "electron";
import type { LogFunctions } from "electron-log";
import log from "electron-log";
import { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "path";
import { schedulerService } from "../scheduler-service";

// electron-log LogFunctions doesn't include 'fatal', map it to 'error'
type ElectronLogLevel = "debug" | "info" | "warn" | "error";
const mapLevel = (level: LogLevel): ElectronLogLevel => (level === "fatal" ? "error" : level);

export class LoggerService {
	private scopeCache = new Map<string, LogFunctions>();

	private logsPath = isDev ? join(process.cwd(), "logs") : join(app.getPath("userData"), "logs");

	constructor() {
		log.initialize();
		this.configureTransports();
		if (!isDev) {
			this.cleanupOldLogs();
			schedulerService.addTask("log-cleanup", "0 0 */24 * * *", () => this.cleanupOldLogs());
		}
	}

	private configureTransports() {
		// ─── File transport ──────────────────────────────────
		log.transports.file.level = isDev ? "debug" : "info";
		log.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}";

		// Resolve path: {logsPath}/{processType}/{date}/{category}.log
		log.transports.file.resolvePathFn = (_variables, message) => {
			const scope = message?.scope || "main/app";
			const hasSlash = scope.includes("/");
			const processType = hasSlash ? scope.split("/")[0] : "renderer";
			const category = hasSlash ? scope.split("/")[1] : scope;
			const now = new Date();
			const date = now.toISOString().slice(0, 10);
			const hour = String(now.getHours()).padStart(2, "0");
			const dir = join(this.logsPath, processType, date, hour);
			mkdirSync(dir, { recursive: true });
			return join(dir, `${category}.log`);
		};

		// Production: filter debug and warn
		if (!isDev) {
			const originalFileTransportWriteFn = (log.transports.file as any).writeFn;
			if (typeof originalFileTransportWriteFn === "function") {
				(log.transports.file as any).writeFn = (msg: any) => {
					if (msg.level === "debug" || msg.level === "warn") {
						return;
					}
					originalFileTransportWriteFn(msg);
				};
			}
		}

		// ─── Console transport ───────────────────────────────
		log.transports.console.level = isDev ? "debug" : "info";

		if (isDev) {
			const ANSI: Record<string, string> = {
				error: "\x1b[31m",
				warn: "\x1b[33m",
				info: "\x1b[36m",
				verbose: "\x1b[32m",
				debug: "\x1b[90m",
				silly: "\x1b[90m",
			};
			const R = "\x1b[0m";

			log.transports.console.format = ({ data, level, message }) => {
				const d = message.date;
				const pad = (n: number, len = 2) => String(n).padStart(len, "0");
				const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
				const text = data
					.map((item: any) => {
						if (typeof item === "string") return item;
						if (item instanceof Error) return item.stack || item.message;
						try {
							return JSON.stringify(item);
						} catch (_e) {
							return String(item);
						}
					})
					.join(" ");
				const c = ANSI[level] || "";
				return [`${c}[${ts}] [${level}]${R} ${text}`];
			};
		} else {
			log.transports.console.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}";
		}
	}

	private getScoped(category: string): LogFunctions {
		if (!this.scopeCache.has(category)) {
			this.scopeCache.set(category, log.scope(category));
		}
		return this.scopeCache.get(category)!;
	}

	/**
	 * IPC handler — retained for auto-generated IPC registration compatibility.
	 */
	log(
		_event: IpcMainInvokeEvent,
		level: LogLevel,
		category: LogCategory,
		processType: "main" | "renderer",
		message: string,
		args: any[],
	): Promise<void> {
		const scoped = this.getScoped(`${processType}/${category}`);
		scoped[mapLevel(level)](message, ...args);
		return Promise.resolve();
	}

	// Direct call from main process (via initMainProcessLogger DI)
	logMain(level: LogLevel, category: LogCategory, message: string, ...args: any[]): void {
		const scoped = this.getScoped(`main/${category}`);
		scoped[mapLevel(level)](message, ...args);
	}

	/**
	 * Export logs within a time range as a zip file.
	 */
	async exportLogs(
		_event: IpcMainInvokeEvent,
		startDate: string,
		startHour: number,
		endDate: string,
		endHour: number,
	): Promise<string | null | undefined> {
		if (!existsSync(this.logsPath)) return null;

		// Collect matching log files
		const files: Array<{ absPath: string; relPath: string }> = [];

		for (const ptEntry of readdirSync(this.logsPath, { withFileTypes: true })) {
			if (!ptEntry.isDirectory()) continue;
			const processType = ptEntry.name;
			const processDir = join(this.logsPath, processType);

			for (const dateEntry of readdirSync(processDir, { withFileTypes: true })) {
				if (!dateEntry.isDirectory()) continue;
				const date = dateEntry.name;
				// Skip dates outside range
				if (date < startDate || date > endDate) continue;

				const dateDir = join(processDir, date);

				for (const hourEntry of readdirSync(dateDir, { withFileTypes: true })) {
					if (!hourEntry.isDirectory()) continue;
					const hour = parseInt(hourEntry.name, 10);
					if (isNaN(hour)) continue;

					// Check hour boundaries for start/end dates
					if (date === startDate && hour < startHour) continue;
					if (date === endDate && hour > endHour) continue;

					const hourDir = join(dateDir, hourEntry.name);
					for (const file of readdirSync(hourDir, { withFileTypes: true })) {
						if (file.isFile()) {
							files.push({
								absPath: join(hourDir, file.name),
								relPath: join(processType, date, hourEntry.name, file.name),
							});
						}
					}
				}
			}
		}

		if (files.length === 0) return null;

		// Ask user for save location
		const { canceled, filePath } = await dialog.showSaveDialog({
			title: "Export Logs",
			defaultPath: `302ai-studio-logs-${startDate}-${String(startHour).padStart(2, "0")}-to-${endDate}-${String(endHour).padStart(2, "0")}.zip`,
			filters: [{ name: "Zip Archive", extensions: ["zip"] }],
		});
		if (canceled || !filePath) return undefined;

		// Create zip
		await new Promise<void>((resolve, reject) => {
			const output = createWriteStream(filePath);
			const archive = archiver("zip", { zlib: { level: 9 } });

			output.on("close", () => resolve());
			archive.on("error", (err) => reject(err));

			archive.pipe(output);

			for (const f of files) {
				archive.file(f.absPath, { name: f.relPath });
			}

			archive.finalize();
		});

		return filePath;
	}

	/** Delete log date directories older than 14 days. */
	private cleanupOldLogs(): void {
		const maxAge = 14 * 24 * 60 * 60 * 1000;
		const cutoff = Date.now() - maxAge;

		if (!existsSync(this.logsPath)) return;

		for (const processType of readdirSync(this.logsPath, { withFileTypes: true })) {
			if (!processType.isDirectory()) continue;
			const processDir = join(this.logsPath, processType.name);

			for (const dateEntry of readdirSync(processDir, { withFileTypes: true })) {
				if (!dateEntry.isDirectory()) continue;
				const parsed = Date.parse(dateEntry.name);
				if (isNaN(parsed)) continue;

				if (parsed < cutoff) {
					const target = join(processDir, dateEntry.name);
					rmSync(target, { recursive: true, force: true });
				}
			}
		}
	}
}

export const loggerService = new LoggerService();
