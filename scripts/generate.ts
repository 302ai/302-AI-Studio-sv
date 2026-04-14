#!/usr/bin/env tsx

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import dedent from "dedent";

// ── Utilities ──────────────────────────────────────────────────────────

function toKebab(str: string): string {
	return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function toLowerFirst(str: string): string {
	return str.charAt(0).toLowerCase() + str.slice(1);
}

const PROJECT_ROOT = path.resolve(process.cwd());
const SERVICES_INDEX = path.join(PROJECT_ROOT, "electron/main/services/index.ts");
const STORES_INDEX = path.join(PROJECT_ROOT, "src/lib/stores/index.ts");

// ── Index File Helpers ─────────────────────────────────────────────────

function insertAlphabetically(
	lines: string[],
	line: string,
	matchFn: (l: string) => boolean,
): void {
	let idx = -1;
	for (let i = 0; i < lines.length; i++) {
		if (matchFn(lines[i])) {
			if (line.localeCompare(lines[i]) <= 0) {
				idx = i;
				break;
			}
		}
	}
	if (idx === -1) {
		for (let i = lines.length - 1; i >= 0; i--) {
			if (matchFn(lines[i])) {
				idx = i + 1;
				break;
			}
		}
	}
	if (idx !== -1) lines.splice(idx, 0, line);
}

function insertIntoExportBlock(lines: string[], labelComment: string, entry: string): void {
	const commentIdx = lines.findIndex((l) => l.includes(labelComment));
	if (commentIdx === -1) return;

	let blockStart = -1;
	for (let i = commentIdx + 1; i < lines.length; i++) {
		if (lines[i].trim() === "export {") {
			blockStart = i;
			break;
		}
	}
	if (blockStart === -1) return;

	let blockEnd = -1;
	for (let i = blockStart + 1; i < lines.length; i++) {
		if (lines[i].trim() === "};") {
			blockEnd = i;
			break;
		}
	}
	if (blockEnd === -1) return;

	const entries: string[] = [];
	for (let i = blockStart + 1; i < blockEnd; i++) {
		const name = lines[i].replace(/[,\s]/g, "");
		if (name) entries.push(name);
	}

	if (!entries.includes(entry)) entries.push(entry);
	entries.sort();

	const newEntries = entries.map((e) => `\t${e},`);
	lines.splice(blockStart + 1, blockEnd - blockStart - 1, ...newEntries);
}

function updateServicesIndex(kebab: string, className: string): void {
	const content = fs.readFileSync(SERVICES_INDEX, "utf-8");
	const lines = content.split("\n");
	const instanceName = `${toLowerFirst(className)}Service`;

	const importLine = `import { ${className}Service, ${instanceName} } from "./${kebab}-service";`;
	insertAlphabetically(lines, importLine, (l) => /^import \{.*\} from "\.\/.*";$/.test(l));

	insertIntoExportBlock(lines, "// Export service classes", `${className}Service`);
	insertIntoExportBlock(lines, "// Export service instances", instanceName);

	fs.writeFileSync(SERVICES_INDEX, lines.join("\n"));
}

function updateStoresIndex(kebab: string): void {
	const content = fs.readFileSync(STORES_INDEX, "utf-8");
	const lines = content.split("\n");
	const importLine = `import "./${kebab}-state.svelte";`;

	insertAlphabetically(lines, importLine, (l) => /^import "\.\/.*";$/.test(l));

	fs.writeFileSync(STORES_INDEX, lines.join("\n"));
}

// ── Formatting ─────────────────────────────────────────────────────────

function formatFiles(files: string[]): void {
	for (const file of files) {
		try {
			execSync(`pnpm prettier --write "${file}"`, { cwd: PROJECT_ROOT, stdio: "pipe" });
		} catch {
			console.warn(`  Warning: failed to format ${file}`);
		}
	}
}

// ── Service Generation ─────────────────────────────────────────────────

function generateService(className: string): void {
	const kebab = toKebab(className);
	const instanceName = `${toLowerFirst(className)}Service`;
	const dir = path.join(PROJECT_ROOT, "electron/main/services", `${kebab}-service`);

	fs.mkdirSync(dir, { recursive: true });

	const template = dedent`
		import { createLogger } from "@shared/logger";

		const logger = createLogger("services");
		import type { IpcMainInvokeEvent } from "electron";

		/**
		 * ${className} service
		 */
		export class ${className}Service {
			// TODO: Add dependencies as needed

			/**
			 * ${className} regular method
			 */
			someMethod(): void {
				// TODO: Implement
			}

			/**
			 * IPC: ${className} IPC handler example
			 */
			async handleSomething(_event: IpcMainInvokeEvent): Promise<void> {
				// TODO: Implement
			}
		}

		export const ${instanceName} = new ${className}Service();
	`;

	const serviceFile = path.join(dir, "index.ts");
	fs.writeFileSync(serviceFile, template);

	updateServicesIndex(kebab, className);

	console.log(`\n  Created ${path.relative(PROJECT_ROOT, serviceFile)}`);
	console.log(`  Updated electron/main/services/index.ts\n`);

	formatFiles([serviceFile, SERVICES_INDEX]);
}

// ── State Generation ───────────────────────────────────────────────────

function generateState(className: string, persist: boolean, scoped: boolean): void {
	const kebab = toKebab(className);
	const instanceName = `${toLowerFirst(className)}State`;
	const storageDir = path.join(PROJECT_ROOT, "src/shared/storage");
	const storesDir = path.join(PROJECT_ROOT, "src/lib/stores");

	const typeFile = path.join(storageDir, `${kebab}.ts`);
	const typeTemplate = dedent`
		/**
		 * ${className} state type definitions
		 */
		export interface ${className}State {
			// TODO: Define state shape
		}
	`;
	fs.writeFileSync(typeFile, typeTemplate);

	const stateFile = path.join(storesDir, `${kebab}-state.svelte.ts`);
	let stateTemplate: string;

	if (!persist) {
		stateTemplate = dedent`
			import { createLogger } from "@shared/logger";

			const logger = createLogger("state");
			import type { ${className}State } from "@shared/storage/${kebab}";

			class ${className}StateManager {
				// TODO: Implement state management
			}

			export const ${instanceName} = new ${className}StateManager();
		`;
	} else if (scoped) {
		stateTemplate = dedent`
			import { createLogger } from "@shared/logger";

			const logger = createLogger("state");
			import { PersistedState } from "$lib/hooks/persisted-state.svelte";
			import type { ${className}State } from "@shared/storage/${kebab}";

			const tab = window.tab ?? null;
			const threadId =
				tab && typeof tab === "object" && "threadId" in tab && typeof tab.threadId === "string" && tab.threadId
					? tab.threadId
					: "shell";

			const getDefaults = (): ${className}State => ({
				// TODO: Define initial values
			});

			export const persisted${className}State = new PersistedState<${className}State>(
				\`${className}Storage:${kebab}-state-\${threadId}\`,
				getDefaults(),
			);

			class ${className}StateManager {
				#updateState(partial: Partial<${className}State>): void {
					logger.debug(\`[${className}StateManager] updateState\`, partial);
					persisted${className}State.current = {
						...(persisted${className}State.current ?? getDefaults()),
						...partial,
					};
				}
			}

			export const ${instanceName} = new ${className}StateManager();
		`;
	} else {
		stateTemplate = dedent`
			import { createLogger } from "@shared/logger";

			const logger = createLogger("state");
			import { PersistedState } from "$lib/hooks/persisted-state.svelte";
			import type { ${className}State } from "@shared/storage/${kebab}";

			const getDefaults = (): ${className}State => ({
				// TODO: Define initial values
			});

			export const persisted${className}State = new PersistedState<${className}State>(
				"${className}Storage:state",
				getDefaults(),
			);

			class ${className}StateManager {
				#updateState(partial: Partial<${className}State>): void {
					logger.debug(\`[${className}StateManager] updateState\`, partial);
					persisted${className}State.current = {
						...(persisted${className}State.current ?? getDefaults()),
						...partial,
					};
				}
			}

			export const ${instanceName} = new ${className}StateManager();
		`;
	}

	fs.writeFileSync(stateFile, stateTemplate);

	updateStoresIndex(kebab);

	console.log(`\n  Created ${path.relative(PROJECT_ROOT, typeFile)}`);
	console.log(`  Created ${path.relative(PROJECT_ROOT, stateFile)}`);
	console.log(`  Updated src/lib/stores/index.ts\n`);

	formatFiles([typeFile, stateFile, STORES_INDEX]);
}

// ── Main ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const subcommand = args[0];
const className = args[1];
const flags = args.slice(2);

if (!subcommand || !className) {
	console.error("Usage:");
	console.error("  pnpm gen:service <ClassName>");
	console.error("  pnpm gen:state <ClassName> [--persist] [--scoped]");
	process.exit(1);
}

const persist = flags.includes("--persist");
const scoped = flags.includes("--scoped");

if (subcommand === "service") {
	generateService(className);
} else if (subcommand === "state") {
	generateState(className, persist, scoped);
} else {
	console.error(`Unknown subcommand: ${subcommand}. Use "service" or "state".`);
	process.exit(1);
}
