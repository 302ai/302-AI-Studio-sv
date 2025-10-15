#!/usr/bin/env node
/**
 * Build script for creating macOS universal binaries
 * This script merges arm64 and x64 .app bundles into a universal binary
 */

import { makeUniversalApp } from "@electron/universal";
import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

async function buildUniversal() {
	console.log("🔨 Building macOS Universal binary...");

	const arm64AppPath = join(projectRoot, "out", "302 AI Studio-darwin-arm64", "302 AI Studio.app");
	const x64AppPath = join(projectRoot, "out", "302 AI Studio-darwin-x64", "302 AI Studio.app");
	const universalAppPath = join(
		projectRoot,
		"out",
		"302 AI Studio-darwin-universal",
		"302 AI Studio.app",
	);

	// Check if arm64 and x64 builds exist
	if (!existsSync(arm64AppPath)) {
		console.error(`❌ ARM64 build not found at: ${arm64AppPath}`);
		console.log("Please run: pnpm run package -- --arch=arm64");
		process.exit(1);
	}

	if (!existsSync(x64AppPath)) {
		console.error(`❌ x64 build not found at: ${x64AppPath}`);
		console.log("Please run: pnpm run package -- --arch=x64");
		process.exit(1);
	}

	console.log("✅ Found ARM64 build:", arm64AppPath);
	console.log("✅ Found x64 build:", x64AppPath);

	// Create output directory
	const universalDir = dirname(universalAppPath);
	if (!existsSync(universalDir)) {
		mkdirSync(universalDir, { recursive: true });
	}

	try {
		console.log("🔄 Merging ARM64 and x64 binaries...");
		await makeUniversalApp({
			arm64AppPath,
			x64AppPath,
			outAppPath: universalAppPath,
			infoPlistsToIgnore: "302 AI Studio.app/Contents/Info.plist",
		});

		console.log("✅ Universal binary created successfully!");
		console.log("📦 Output:", universalAppPath);
	} catch (error) {
		console.error("❌ Failed to create universal binary:", error);
		process.exit(1);
	}
}

buildUniversal().catch((error) => {
	console.error("❌ Unexpected error:", error);
	process.exit(1);
});
