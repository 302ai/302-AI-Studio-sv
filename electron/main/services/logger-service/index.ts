/* eslint-disable @typescript-eslint/no-explicit-any */
import log from "electron-log";
import type { LogFunctions } from "electron-log";
import { isDev } from "@electron/main/constants";
import { userDataManager } from "../app-service/user-data-manager";
import type { LogLevel, LogCategory } from "@shared/logger/types";
import type { IpcMainInvokeEvent } from "electron";
import { join } from "path";
import { mkdirSync } from "node:fs";

// electron-log LogFunctions doesn't include 'fatal', map it to 'error'
type ElectronLogLevel = "debug" | "info" | "warn" | "error";
const mapLevel = (level: LogLevel): ElectronLogLevel => (level === "fatal" ? "error" : level);

export class LoggerService {
	private scopeCache = new Map<string, LogFunctions>();

	constructor() {
		log.initialize();
		this.configureTransports();
	}

	private configureTransports() {
		const logsPath = isDev
			? join(process.cwd(), "logs")
			: join(userDataManager.storagePath, "logs");

		// ─── File transport ──────────────────────────────────
		log.transports.file.level = isDev ? "debug" : "info";
		log.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}";

		// Resolve path: {logsPath}/{processType}/{date}/{category}.log
		log.transports.file.resolvePathFn = (_variables, message) => {
			const scope = message?.scope || "main/app";
			const hasSlash = scope.includes("/");
			const processType = hasSlash ? scope.split("/")[0] : "renderer";
			const category = hasSlash ? scope.split("/")[1] : scope;
			const date = new Date().toISOString().slice(0, 10);
			const dir = join(logsPath, processType, date);
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
					.map((item: any) => (typeof item === "string" ? item : String(item)))
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
}

export const loggerService = new LoggerService();
