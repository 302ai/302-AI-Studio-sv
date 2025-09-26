/* eslint-disable @typescript-eslint/no-explicit-any */
import { nanoid } from "nanoid";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse, stringify } from "superjson";

export class TempStorage {
	private static readonly TEMP_DIR = join(tmpdir(), "302ai-studio-temp");
	private static readonly cleanupRegistry = new Set<string>();

	static ensureTempDir(): void {
		if (!existsSync(this.TEMP_DIR)) {
			mkdirSync(this.TEMP_DIR, { recursive: true });
		}
	}

	static writeData(data: any, prefix: string = "data"): string {
		this.ensureTempDir();

		const fileName = `${prefix}-${nanoid()}.json`;
		const filePath = join(this.TEMP_DIR, fileName);

		try {
			const serializedData = stringify(data);
			writeFileSync(filePath, serializedData, "utf8");

			this.cleanupRegistry.add(filePath);

			return filePath;
		} catch (error) {
			console.error("TempStorage: Failed to write data", error);
			throw new Error(`Failed to write temporary file: ${error}`);
		}
	}

	static readData<T = any>(filePath: string): T | null {
		if (!existsSync(filePath)) {
			console.warn("TempStorage: File does not exist", filePath);
			return null;
		}

		try {
			const serializedData = readFileSync(filePath, "utf8");
			return parse(serializedData) as T;
		} catch (error) {
			console.error("TempStorage: Failed to read data", error);
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
			console.warn("TempStorage: Failed to cleanup file", filePath, error);
		}
	}

	static cleanupAll(): void {
		for (const filePath of this.cleanupRegistry) {
			this.cleanupFile(filePath);
		}
		this.cleanupRegistry.clear();
	}
}
