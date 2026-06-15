/* eslint-disable @typescript-eslint/no-explicit-any */
import { nanoid } from "nanoid";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "superjson";
import { createLogger } from "@shared/logger";
import { cacheManager } from "../services/cache-manager";

const logger = createLogger("utils");

export class TempStorage {
	private static cleanupRegistry = new Set<string>();

	static getTempDir(): string {
		return cacheManager.getTempCacheDir();
	}

	static ensureTempDir(): void {
		const tempDir = this.getTempDir();
		if (!existsSync(tempDir)) {
			mkdirSync(tempDir, { recursive: true });
		}
	}

	static writeData(data: any, prefix: string = "data"): string {
		this.ensureTempDir();

		const fileName = `${prefix}-${nanoid()}.json`;
		const filePath = join(this.getTempDir(), fileName);

		try {
			const serializedData = stringify(data);
			writeFileSync(filePath, serializedData, "utf8");

			this.cleanupRegistry.add(filePath);

			return filePath;
		} catch (error) {
			logger.error("TempStorage: Failed to write data", error);
			throw new Error(`Failed to write temporary file: ${error}`);
		}
	}

	static readData<T = any>(filePath: string): T | null {
		if (!existsSync(filePath)) {
			logger.warn("TempStorage: File does not exist", filePath);
			return null;
		}

		try {
			const serializedData = readFileSync(filePath, "utf8");
			return parse(serializedData) as T;
		} catch (error) {
			logger.error("TempStorage: Failed to read data", error);
			return null;
		}
	}
	static cleanupFile(filePath: string): void {
		try {
			if (existsSync(filePath)) {
				unlinkSync(filePath);
			}
			this.cleanupRegistry.delete(filePath);
		} catch (error) {
			logger.warn("TempStorage: Failed to cleanup file", filePath, error);
		}
	}

	static cleanupAll(): void {
		for (const filePath of this.cleanupRegistry) {
			this.cleanupFile(filePath);
		}
		this.cleanupRegistry.clear();
	}
}
