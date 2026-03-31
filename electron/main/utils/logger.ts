/* eslint-disable @typescript-eslint/no-explicit-any */
import chalk from "chalk";
import dayjs from "dayjs";

/**
 * Log level enumeration defines different log levels
 */
export const LogLevel = {
	DEBUG: "DEBUG",
	INFO: "INFO",
	WARN: "WARN",
	ERROR: "ERROR",
} as const;
type LogLevelType = (typeof LogLevel)[keyof typeof LogLevel];

/**
 * Log recorder class, used for outputting logs of different levels
 */
export class Logger {
	protected module: string;

	/**
	 * Constructor, initializes the logger
	 * @param module Module name, if not provided, the class name will be used as the module name
	 */
	constructor(module: string) {
		this.module = module || this.constructor.name;
	}

	protected log(level: LogLevelType, ...msg: any[]) {
		const now = dayjs().format("HH:mm:ss.SSS");
		console.log(`${now}`, this.formatLevel(level), this.formatModule(), `: ${msg}`);
	}

	protected formatLevel(level: LogLevelType): string {
		let levelFn = chalk.blue;
		switch (level) {
			case LogLevel.DEBUG:
				levelFn = chalk.blue;
				break;
			case LogLevel.INFO:
				levelFn = chalk.green;
				break;
			case LogLevel.WARN:
				levelFn = chalk.yellow;
				break;
			case LogLevel.ERROR:
				levelFn = chalk.red;
				break;
		}
		return levelFn(`[${level}]`);
	}

	protected formatModule(): string {
		return chalk.hex("#2589B2")(`{${this.module}}`);
	}

	debug(...msg: any[]) {
		this.log(LogLevel.DEBUG, ...msg);
	}

	info(...msg: any[]) {
		this.log(LogLevel.INFO, ...msg);
	}

	warn(...msg: any[]) {
		this.log(LogLevel.WARN, ...msg);
	}

	error(...msg: any[]) {
		this.log(LogLevel.ERROR, ...msg);
	}
}

/**
 * Create an instance of the logger.
 * @param _this - The object instance that needs to log messages
 * @returns Returns a logger instance identified by the class name
 */
export function createLogger(_this: object) {
	return new Logger(_this.constructor.name);
}
