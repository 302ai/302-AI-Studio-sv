import { confirm, input, select } from "@inquirer/prompts";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import semver from "semver";

type ReleaseCommand = "patch" | "minor" | "major" | "to" | "beta" | "stable" | "interactive";

/**
 * Check if a version is a beta prerelease
 */
function isBetaVersion(version: string): boolean {
	const prerelease = semver.prerelease(version);
	return Array.isArray(prerelease) && prerelease[0] === "beta";
}

/**
 * Get the base version without prerelease suffix
 * e.g., "25.50.18-beta.2" -> "25.50.18"
 */
function getBaseVersion(version: string): string {
	const parsed = semver.parse(version);
	if (!parsed) return version;
	return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
}

/**
 * Calculate the next beta version
 * - If current is stable (e.g., 25.50.18): bump patch + add -beta.1 -> 25.50.19-beta.1
 * - If current is beta (e.g., 25.50.18-beta.1): increment beta number -> 25.50.18-beta.2
 */
function getNextBetaVersion(currentVersion: string, bump = 1): string {
	if (isBetaVersion(currentVersion)) {
		// Already a beta, increment the beta number
		let version = currentVersion;
		for (let i = 0; i < bump; i++) {
			const next = semver.inc(version, "prerelease", "beta");
			if (!next) throw new Error(`Failed to increment beta version from ${version}`);
			version = next;
		}
		return version;
	} else {
		// Stable version, bump patch and add -beta.1
		let version = currentVersion;
		// First bump to get the base patch version
		const patchBumped = semver.inc(version, "patch");
		if (!patchBumped) throw new Error(`Failed to bump patch version from ${version}`);

		// For bump > 1, we need to bump additional patches first
		version = patchBumped;
		for (let i = 1; i < bump; i++) {
			const next = semver.inc(version, "patch");
			if (!next) throw new Error(`Failed to bump patch version from ${version}`);
			version = next;
		}
		return `${version}-beta.1`;
	}
}

/**
 * Calculate the next stable version with optional bump count
 * - If current is beta (e.g., 25.50.18-beta.2): drop beta suffix -> 25.50.18
 * - If current is stable: use standard semver bump
 */
function getNextStableVersion(
	currentVersion: string,
	releaseType: "patch" | "minor" | "major",
	bump = 1,
): string {
	if (isBetaVersion(currentVersion)) {
		// From beta to stable: just drop the beta suffix
		return getBaseVersion(currentVersion);
	} else {
		// Standard semver bump with optional bump count
		let version = currentVersion;
		for (let i = 0; i < bump; i++) {
			const next = semver.inc(version, releaseType);
			if (!next) throw new Error(`Failed to bump ${releaseType} version from ${version}`);
			version = next;
		}
		return version;
	}
}

type CliOptions = {
	to?: string;
	from?: string;
	bump: number;
	notes?: string;
	dryRun: boolean;
	allowDirty: boolean;
	noCommit: boolean;
	noTag: boolean;
	push: boolean;
	skipAppInfo: boolean;
	skipQuality: boolean;
};

const ROOT = path.resolve(process.cwd());

function die(message: string, exitCode = 1): never {
	console.error(message);
	process.exit(exitCode);
}

function run(cmd: string, args: string[], opts?: { cwd?: string; stdio?: "inherit" | "pipe" }) {
	const res = spawnSync(cmd, args, {
		cwd: opts?.cwd ?? ROOT,
		encoding: "utf-8",
		stdio: opts?.stdio ?? "pipe",
	});

	if (res.status !== 0) {
		const stderr = typeof res.stderr === "string" ? res.stderr.trim() : "";
		const stdout = typeof res.stdout === "string" ? res.stdout.trim() : "";
		const detail = [stdout, stderr].filter(Boolean).join("\n");
		throw new Error(`Command failed: ${cmd} ${args.join(" ")}\n${detail}`);
	}

	return {
		stdout: typeof res.stdout === "string" ? res.stdout : "",
		stderr: typeof res.stderr === "string" ? res.stderr : "",
	};
}

function parseArgs(argv: string[]): { command: ReleaseCommand; options: CliOptions } {
	const first = argv[0];
	const hasCommand = !!first && !first.startsWith("--");
	const command = (hasCommand ? first : "interactive") as ReleaseCommand;
	const rest = hasCommand ? argv.slice(1) : argv;

	if (!["patch", "minor", "major", "to", "beta", "stable", "interactive"].includes(command)) {
		die(
			[
				"Usage:",
				'  pnpm tsx scripts/release.ts patch|minor|major [--bump N] [--from <version>] [--notes "..."] [--push] [--skip-quality]',
				'  pnpm tsx scripts/release.ts to --to <version> [--notes "..."] [--push] [--skip-quality]',
				'  pnpm tsx scripts/release.ts beta [--bump N] [--notes "..."] [--push] [--skip-quality]',
				'  pnpm tsx scripts/release.ts stable [--notes "..."] [--push] [--skip-quality]',
				"  pnpm tsx scripts/release.ts  (interactive)",
				"",
				"Commands:",
				"  patch                  Bump patch version (25.50.18 -> 25.50.19)",
				"                         From beta: release stable (25.50.18-beta.2 -> 25.50.18)",
				"  minor                  Bump minor version (25.50.18 -> 25.51.0)",
				"                         From beta: release stable (25.50.18-beta.2 -> 25.50.18)",
				"  major                  Bump major version (25.50.18 -> 26.0.0)",
				"                         From beta: release stable (25.50.18-beta.2 -> 25.50.18)",
				"  beta                   Create beta version:",
				"                         From stable: 25.50.18 -> 25.50.19-beta.1",
				"                         From beta: 25.50.18-beta.1 -> 25.50.18-beta.2",
				"  stable                 Release stable from beta (25.50.18-beta.2 -> 25.50.18)",
				"  to                     Set exact version",
				"",
				"Options:",
				"  --to <version>         Target version when using 'to'",
				"  --from <version>       Base version for calculation (default: current package.json version)",
				"  --bump <N>             Number of versions to bump (default: 1)",
				"                         Examples:",
				"                           patch --bump 2: 25.50.18 -> 25.50.20",
				"                           minor --bump 3: 25.50.18 -> 25.53.0",
				"                           beta --bump 2:  25.50.18 -> 25.50.20-beta.1",
				"  --notes <text>         Optional tag annotation message",
				"  --dry-run              Print what would change; do not write/commit/tag",
				"  --allow-dirty          Allow running with uncommitted changes",
				"  --no-commit            Do not create a release commit",
				"  --no-tag               Do not create a git tag",
				"  --push                 Push commit + tags to origin",
				"  --skip-app-info        Do not sync src/lib/app-info.ts",
				"  --skip-quality         Skip running quality checks (pnpm quality) before release",
			].join("\n"),
		);
	}

	const options: CliOptions = {
		to: undefined,
		from: undefined,
		bump: 1,
		notes: undefined,
		dryRun: false,
		allowDirty: false,
		noCommit: false,
		noTag: false,
		push: false,
		skipAppInfo: false,
		skipQuality: false,
	};

	for (let i = 0; i < rest.length; i++) {
		const a = rest[i];
		if (a === "--to") options.to = rest[++i];
		else if (a === "--from") options.from = rest[++i];
		else if (a === "--bump") {
			const bumpValue = parseInt(rest[++i], 10);
			if (isNaN(bumpValue) || bumpValue < 1) {
				die(`Invalid --bump value: ${rest[i]}. Must be a positive integer.`);
			}
			options.bump = bumpValue;
		} else if (a === "--notes") options.notes = rest[++i];
		else if (a === "--dry-run") options.dryRun = true;
		else if (a === "--allow-dirty") options.allowDirty = true;
		else if (a === "--no-commit") options.noCommit = true;
		else if (a === "--no-tag") options.noTag = true;
		else if (a === "--push") options.push = true;
		else if (a === "--skip-app-info") options.skipAppInfo = true;
		else if (a === "--skip-quality") options.skipQuality = true;
		else die(`Unknown option: ${a}`);
	}

	return { command, options };
}

async function readText(filePath: string) {
	return fs.readFile(filePath, "utf-8");
}

async function writeText(filePath: string, contents: string, dryRun: boolean) {
	if (dryRun) return;
	await fs.writeFile(filePath, contents);
}

function ensureCleanGit(allowDirty: boolean) {
	if (allowDirty) return;
	const { stdout } = run("git", ["status", "--porcelain"]);
	if (stdout.trim() !== "") {
		die(
			[
				"Working tree is not clean.",
				"Commit/stash your changes or rerun with --allow-dirty.",
			].join("\n"),
		);
	}
}

function runQualityChecks(skipQuality: boolean) {
	if (skipQuality) {
		console.log("⏭️  Skipping quality checks (--skip-quality)");
		return;
	}
	console.log("🔍 Running quality checks (pnpm quality)...");
	try {
		run("pnpm", ["quality"], { stdio: "inherit" });
		console.log("✅ Quality checks passed\n");
	} catch {
		die(
			[
				"❌ Quality checks failed.",
				"Fix the issues and try again, or rerun with --skip-quality to bypass.",
			].join("\n"),
		);
	}
}

function maybeUpdateAppInfoVersion(
	source: string,
	nextVersion: string,
): { contents: string; changed: boolean; reason?: "injected" } {
	// If version is injected at build time, do not modify the file.
	if (/\bversion\s*:\s*__APP_VERSION__\b/.test(source)) {
		return { contents: source, changed: false, reason: "injected" };
	}

	// Manual string version fallback (legacy)
	const re = /^(\s*version\s*:\s*)(["'])([^"']+)(\2)(\s*,?)/m;
	const m = source.match(re);
	if (!m) {
		throw new Error(
			"Failed to locate appInfo.version in src/lib/app-info.ts (expected __APP_VERSION__ or a string literal)",
		);
	}

	const current = m[3];
	if (current === nextVersion) return { contents: source, changed: false };

	const contents = source.replace(re, `$1$2${nextVersion}$2$5`);
	return { contents, changed: true };
}

function updatePackageJsonVersion(source: string, nextVersion: string) {
	const parsed = JSON.parse(source) as { version?: string } & Record<string, unknown>;
	parsed.version = nextVersion;
	return JSON.stringify(parsed, null, "\t") + "\n";
}

/**
 * Format version change for display
 */
function formatVersionChange(from: string, to: string): string {
	const fromParsed = semver.parse(from);
	const toParsed = semver.parse(to);

	if (!fromParsed || !toParsed) return `${from} -> ${to}`;

	const parts: string[] = [];
	if (toParsed.major !== fromParsed.major) {
		parts.push(`major: ${fromParsed.major} -> ${toParsed.major}`);
	}
	if (toParsed.minor !== fromParsed.minor) {
		parts.push(`minor: ${fromParsed.minor} -> ${toParsed.minor}`);
	}
	if (toParsed.patch !== fromParsed.patch) {
		parts.push(`patch: ${fromParsed.patch} -> ${toParsed.patch}`);
	}

	const fromBeta = isBetaVersion(from);
	const toBeta = isBetaVersion(to);
	if (fromBeta !== toBeta) {
		parts.push(toBeta ? "adding beta prerelease" : "removing beta prerelease");
	} else if (fromBeta && toBeta) {
		const fromPrerelease = semver.prerelease(from);
		const toPrerelease = semver.prerelease(to);
		if (fromPrerelease && toPrerelease && fromPrerelease[1] !== toPrerelease[1]) {
			parts.push(`beta: ${fromPrerelease[1]} -> ${toPrerelease[1]}`);
		}
	}

	if (parts.length === 0) return `${from} (no change)`;
	return `${from} -> ${to} (${parts.join(", ")})`;
}

async function promptInteractive(
	currentVersion: string,
	packageVersion: string,
	preset: CliOptions,
	appInfoMode: "manual" | "injected" | "unknown",
) {
	const isBeta = isBetaVersion(currentVersion);

	// Ask for bump count first
	const bumpCountStr = await input({
		message: "How many versions to bump? (1 = normal, 2+ = skip versions)",
		default: String(preset.bump),
		validate: (v) => {
			const n = parseInt(v, 10);
			return !isNaN(n) && n >= 1 ? true : "Must be a positive integer";
		},
	});
	const bumpCount = parseInt(bumpCountStr, 10);

	const nextBeta = getNextBetaVersion(currentVersion, bumpCount);
	const nextStable = isBeta ? getNextStableVersion(currentVersion, "patch") : null;

	const choices: Array<{ name: string; value: Exclude<ReleaseCommand, "interactive"> }> = [];

	if (isBeta) {
		// Current version is beta, show stable release option first
		choices.push({
			name: `Stable: ${formatVersionChange(currentVersion, nextStable!)}`,
			value: "stable",
		});
		choices.push({
			name: `Beta: ${formatVersionChange(currentVersion, nextBeta)}`,
			value: "beta",
		});
	} else {
		// Current version is stable - show with bump count
		const nextPatch = getNextStableVersion(currentVersion, "patch", bumpCount);
		const nextMinor = getNextStableVersion(currentVersion, "minor", bumpCount);
		const nextMajor = getNextStableVersion(currentVersion, "major", bumpCount);

		choices.push({
			name: `Patch: ${formatVersionChange(currentVersion, nextPatch)}`,
			value: "patch",
		});
		choices.push({
			name: `Minor: ${formatVersionChange(currentVersion, nextMinor)}`,
			value: "minor",
		});
		choices.push({
			name: `Major: ${formatVersionChange(currentVersion, nextMajor)}`,
			value: "major",
		});
		choices.push({
			name: `Beta: ${formatVersionChange(currentVersion, nextBeta)}`,
			value: "beta",
		});
	}

	choices.push({ name: `Set exact version (to)`, value: "to" });

	const action = await select<Exclude<ReleaseCommand, "interactive">>({
		message: "Select release type",
		choices,
	});

	const options: CliOptions = {
		...preset,
		bump: bumpCount,
	};

	if (action === "to") {
		options.to = await input({
			message: "Target version (semver)",
			default: currentVersion,
			validate: (v) => (semver.valid(v) ? true : "Invalid semver version (e.g. 25.50.9)"),
		});
	}

	options.notes = await input({
		message: "Tag annotation message (optional)",
		default: preset.notes ?? "",
	});

	if (appInfoMode === "manual") {
		const syncAppInfo = await confirm({
			message: "Sync src/lib/app-info.ts ?",
			default: !preset.skipAppInfo,
		});
		options.skipAppInfo = !syncAppInfo;
	} else {
		// injected/unknown: default skip to avoid breaking injected version
		options.skipAppInfo = true;
	}

	const createCommit = await confirm({
		message: "Create release commit?",
		default: !preset.noCommit,
	});
	options.noCommit = !createCommit;

	const createTag = await confirm({
		message: "Create git tag?",
		default: !preset.noTag,
	});
	options.noTag = !createTag;

	options.push = await confirm({
		message: "Push commit/tag to origin?",
		default: preset.push,
	});

	options.skipQuality = await confirm({
		message: "Skip quality checks (pnpm quality)?",
		default: preset.skipQuality,
	});

	options.dryRun = await confirm({
		message: "Dry-run (no file writes / no git operations)?",
		default: preset.dryRun,
	});

	options.allowDirty = await confirm({
		message: "Allow dirty working tree?",
		default: preset.allowDirty,
	});

	return { command: action, options };
}

async function main() {
	const { command, options } = parseArgs(process.argv.slice(2));
	const isInteractive = command === "interactive";

	const pkgPath = path.join(ROOT, "package.json");
	const appInfoPath = path.join(ROOT, "src/lib/app-info.ts");

	const pkgRaw = await readText(pkgPath);
	const pkg = JSON.parse(pkgRaw) as { version?: string };
	const packageVersion = pkg.version;
	if (!packageVersion || !semver.valid(packageVersion)) {
		die(`Invalid current version in package.json: ${String(packageVersion)}`);
	}

	// Use --from if specified, otherwise use package.json version
	let baseVersion = packageVersion;
	if (options.from) {
		if (!semver.valid(options.from)) {
			die(`Invalid --from version: ${options.from}`);
		}
		baseVersion = options.from;
		console.log(
			`Using base version from --from: ${baseVersion} (package.json: ${packageVersion})`,
		);
	}

	let appInfoMode: "manual" | "injected" | "unknown" = "unknown";
	try {
		const appInfoRaw = await readText(appInfoPath);
		if (/\bversion\s*:\s*__APP_VERSION__\b/.test(appInfoRaw)) appInfoMode = "injected";
		else if (/^\s*version\s*:\s*["']/m.test(appInfoRaw)) appInfoMode = "manual";
	} catch {
		// ignore
	}

	let finalCommand: Exclude<ReleaseCommand, "interactive">;
	let finalOptions: CliOptions;

	if (isInteractive) {
		const resolved = await promptInteractive(baseVersion, packageVersion, options, appInfoMode);
		finalCommand = resolved.command;
		finalOptions = resolved.options;
	} else {
		finalCommand = command;
		finalOptions = options;
	}

	ensureCleanGit(finalOptions.allowDirty);

	let nextVersion = baseVersion;
	const bump = finalOptions.bump;

	if (finalCommand === "to") {
		if (!finalOptions.to) die("Missing --to <version>");
		if (!semver.valid(finalOptions.to)) die(`Invalid --to version: ${finalOptions.to}`);
		nextVersion = finalOptions.to;
	} else if (finalCommand === "beta") {
		// Beta version with optional bump count
		nextVersion = getNextBetaVersion(baseVersion, bump);
	} else if (finalCommand === "stable") {
		// Stable from beta: 25.50.18-beta.2 -> 25.50.18
		if (!isBetaVersion(baseVersion)) {
			die(
				`Cannot release stable: current version ${baseVersion} is not a beta. Use patch/minor/major instead.`,
			);
		}
		nextVersion = getNextStableVersion(baseVersion, "patch");
	} else {
		// patch, minor, major with optional bump count
		nextVersion = getNextStableVersion(baseVersion, finalCommand, bump);
	}

	const tagName = `v${nextVersion}`;

	const tagMessage = finalOptions.notes?.trim() ? finalOptions.notes.trim() : tagName;

	const planned: string[] = [];

	// Show version change summary
	if (nextVersion === packageVersion) {
		planned.push(`- package.json: (no change) ${packageVersion}`);
	} else {
		planned.push(`- package.json: ${formatVersionChange(packageVersion, nextVersion)}`);
	}

	if (options.from && options.from !== packageVersion) {
		planned.push(`  (calculated from base version: ${options.from})`);
	}

	if (!finalOptions.skipAppInfo) {
		if (appInfoMode === "injected")
			planned.push("- src/lib/app-info.ts: uses __APP_VERSION__ (no change)");
		else planned.push(`- src/lib/app-info.ts: ${packageVersion} -> ${nextVersion}`);
	}

	const gitOps: string[] = [];
	if (!finalOptions.noCommit) gitOps.push("- git commit: chore(release)");
	if (!finalOptions.noTag) gitOps.push(`- git tag: ${tagName}`);
	if (finalOptions.push) gitOps.push("- git push (commits + tags)");

	console.log(["Plan:", ...planned, ...gitOps].join("\n"));

	if (finalOptions.dryRun) {
		console.log("\n(dry-run) No files will be modified.");
		return;
	}

	if (isInteractive) {
		const proceed = await confirm({ message: "Proceed?", default: true });
		if (!proceed) {
			console.log("Cancelled.");
			return;
		}
	}

	// Run quality checks before making any changes
	runQualityChecks(finalOptions.skipQuality);

	const filesToAdd: string[] = [];

	if (nextVersion !== packageVersion) {
		await writeText(pkgPath, updatePackageJsonVersion(pkgRaw, nextVersion), false);
		filesToAdd.push(pkgPath);
	}

	if (!finalOptions.skipAppInfo) {
		const appInfoRaw = await readText(appInfoPath);
		const updated = maybeUpdateAppInfoVersion(appInfoRaw, nextVersion);
		if (updated.changed) {
			await writeText(appInfoPath, updated.contents, false);
			filesToAdd.push(appInfoPath);
		}
	}

	if (filesToAdd.length > 0) {
		run("git", ["add", ...filesToAdd.map((p) => path.relative(ROOT, p))], { stdio: "inherit" });
	}

	if (!finalOptions.noCommit && filesToAdd.length > 0) {
		run("git", ["commit", "-m", `chore(release): ${tagName}`], { stdio: "inherit" });
	}

	if (!finalOptions.noTag) {
		run("git", ["tag", "-a", tagName, "-m", tagMessage], { stdio: "inherit" });
	}

	if (finalOptions.push) {
		run("git", ["push"], { stdio: "inherit" });
		run("git", ["push", "--follow-tags"], { stdio: "inherit" });
	}

	console.log(`\nDone: ${tagName}`);
}

main().catch((err) => {
	die(err instanceof Error ? err.message : String(err));
});
