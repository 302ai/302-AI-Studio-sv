#!/usr/bin/env node

/**
 * Add Plugin Helper
 *
 * Interactive CLI tool to add a new plugin to the registry
 */

import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import readline from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REGISTRY_PATH = join(__dirname, "../registry.json");

function createInterface() {
	return readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
}

function question(rl, prompt) {
	return new Promise((resolve) => {
		rl.question(prompt, (answer) => {
			resolve(answer.trim());
		});
	});
}

async function promptPlugin(rl) {
	console.log("\n📦 Add New Plugin to Registry\n");

	const plugin = {};

	// Required fields
	plugin.id = await question(rl, "Plugin ID (lowercase, alphanumeric, hyphens): ");
	plugin.name = await question(rl, "Plugin Name: ");
	plugin.description = await question(rl, "Description: ");
	plugin.author = await question(rl, "Author: ");
	plugin.version = await question(rl, "Version (semver, e.g., 1.0.0): ");
	plugin.downloadUrl = await question(rl, "Download URL (HTTPS, must be .zip): ");
	plugin.repository = await question(rl, "Repository URL: ");

	// Optional fields
	const homepage = await question(rl, "Homepage URL (optional, press Enter to skip): ");
	if (homepage) plugin.homepage = homepage;

	const icon = await question(rl, "Icon URL (optional, press Enter to skip): ");
	if (icon) plugin.icon = icon;

	const tagsStr = await question(rl, "Tags (comma-separated, optional): ");
	if (tagsStr) {
		plugin.tags = tagsStr
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);
	}

	const minSdkVersion = await question(rl, "Minimum SDK Version (e.g., 1.0.0, optional): ");
	if (minSdkVersion) plugin.minSdkVersion = minSdkVersion;

	const readme = await question(rl, "README URL (optional): ");
	if (readme) plugin.readme = readme;

	const changelog = await question(rl, "Changelog URL (optional): ");
	if (changelog) plugin.changelog = changelog;

	const screenshotsStr = await question(rl, "Screenshot URLs (comma-separated, optional): ");
	if (screenshotsStr) {
		plugin.screenshots = screenshotsStr
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
	}

	// Default values
	plugin.downloads = 0;
	plugin.rating = 0;
	plugin.ratingCount = 0;
	plugin.featured = false;
	plugin.publishedAt = new Date().toISOString();
	plugin.updatedAt = new Date().toISOString();

	return plugin;
}

function displayPlugin(plugin) {
	console.log("\n📋 Plugin Information:\n");
	console.log(JSON.stringify(plugin, null, 2));
}

async function addPlugin() {
	const rl = createInterface();

	try {
		// Prompt for plugin information
		const plugin = await promptPlugin(rl);

		// Display for confirmation
		displayPlugin(plugin);

		const confirm = await question(rl, "\n✅ Add this plugin to the registry? (yes/no): ");

		if (confirm.toLowerCase() !== "yes" && confirm.toLowerCase() !== "y") {
			console.log("\n❌ Cancelled");
			rl.close();
			return;
		}

		// Load existing registry
		const registryContent = await readFile(REGISTRY_PATH, "utf-8");
		const registry = JSON.parse(registryContent);

		// Check for duplicate ID
		if (registry.plugins.some((p) => p.id === plugin.id)) {
			console.error(`\n❌ Error: Plugin with ID "${plugin.id}" already exists`);
			rl.close();
			process.exit(1);
		}

		// Add plugin
		registry.plugins.push(plugin);
		registry.lastUpdated = new Date().toISOString();

		// Sort plugins by ID
		registry.plugins.sort((a, b) => a.id.localeCompare(b.id));

		// Write back to file
		await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, "\t") + "\n", "utf-8");

		console.log(`\n✅ Plugin "${plugin.name}" added successfully!`);
		console.log(`   Total plugins: ${registry.plugins.length}`);
		console.log("\n💡 Next steps:");
		console.log("   1. Run: pnpm run validate");
		console.log("   2. Commit changes");
		console.log("   3. Create pull request\n");
	} catch (error) {
		console.error(`\n❌ Error: ${error.message}`);
		process.exit(1);
	} finally {
		rl.close();
	}
}

// Run
addPlugin();
