/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger, LogCategory, LogLevel } from "./types";

// ─── Main process DI ─────────────────────────────────────
let mainLogFn:
	| ((level: LogLevel, category: LogCategory, message: string, ...args: any[]) => void)
	| null = null;

/**
 * Called once during main process startup to inject the loggerService dependency.
 */
export function initMainProcessLogger(
	logFn: (level: LogLevel, category: LogCategory, message: string, ...args: any[]) => void,
) {
	mainLogFn = logFn;
}

// ─── Renderer process DI ──────────────────────────────────
// A function that creates a scoped logger for a given category.
// Injected via initRendererLogger() from the renderer entry point.
let rendererScopeFn:
	| ((category: string) => { debug: any; info: any; warn: any; error: any })
	| null = null;

/**
 * Called once in the renderer entry point to inject electron-log/renderer.
 *
 * Usage (in +layout.svelte or a top-level module):
 * ```ts
 * import log from "electron-log/renderer";
 * import { initRendererLogger } from "@shared/logger";
 * initRendererLogger((category) => log.scope(category));
 * ```
 */
export function initRendererLogger(
	scopeFn: (category: string) => { debug: any; info: any; warn: any; error: any },
) {
	rendererScopeFn = scopeFn;
}

// ─── Process detection ────────────────────────────────────
function isMainProcess(): boolean {
	return typeof process !== "undefined" && process.type === "browser";
}

// ─── Factory ──────────────────────────────────────────────
export function createLogger(category: LogCategory): Logger {
	if (isMainProcess()) {
		return {
			debug: (message: string, ...args: any[]) =>
				mainLogFn?.("debug", category, message, ...args),
			info: (message: string, ...args: any[]) =>
				mainLogFn?.("info", category, message, ...args),
			warn: (message: string, ...args: any[]) =>
				mainLogFn?.("warn", category, message, ...args),
			error: (message: string, ...args: any[]) =>
				mainLogFn?.("error", category, message, ...args),
			fatal: (message: string, ...args: any[]) =>
				mainLogFn?.("fatal", category, message, ...args),
		};
	}

	// Renderer process: use injected electron-log/renderer scope
	const getScope = () => rendererScopeFn?.(category);

	return {
		debug: (message: string, ...args: any[]) => getScope()?.debug(message, ...args),
		info: (message: string, ...args: any[]) => getScope()?.info(message, ...args),
		warn: (message: string, ...args: any[]) => getScope()?.warn(message, ...args),
		error: (message: string, ...args: any[]) => getScope()?.error(message, ...args),
		fatal: (message: string, ...args: any[]) => getScope()?.error(message, ...args),
	};
}
