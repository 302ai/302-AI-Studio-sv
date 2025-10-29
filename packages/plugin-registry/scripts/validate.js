#!/usr/bin/env node

/**
 * Plugin Registry Validator
 *
 * Validates registry.json against the schema and checks:
 * - JSON syntax
 * - Schema compliance
 * - Unique plugin IDs
 * - Valid semver versions
 * - HTTPS URLs
 * - Required fields
 */

import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REGISTRY_PATH = join(__dirname, "../registry.json");
// Schema path for future JSON Schema validation
// const _SCHEMA_PATH = join(__dirname, '../schema.json');

class ValidationError extends Error {
	constructor(message, path = null) {
		super(message);
		this.path = path;
	}
}

async function loadJSON(path) {
	try {
		const content = await readFile(path, "utf-8");
		return JSON.parse(content);
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new ValidationError(`Invalid JSON syntax in ${path}: ${error.message}`);
		}
		throw error;
	}
}

function validateSemver(version) {
	const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
	return semverRegex.test(version);
}

function validateUrl(url, requireHttps = true) {
	try {
		const urlObj = new URL(url);
		if (requireHttps && urlObj.protocol !== "https:") {
			return false;
		}
		return true;
	} catch {
		return false;
	}
}

function validatePlugin(plugin, index) {
	const errors = [];
	const path = `plugins[${index}]`;

	// Check if plugin has metadata object
	if (!plugin.metadata || typeof plugin.metadata !== "object") {
		errors.push(new ValidationError(`Missing or invalid metadata object`, `${path}.metadata`));
		return errors; // Can't continue validation without metadata
	}

	const metadata = plugin.metadata;
	const metadataPath = `${path}.metadata`;

	// Required metadata fields
	const requiredMetadataFields = [
		"id",
		"name",
		"description",
		"author",
		"version",
		"type",
		"permissions",
		"compatibleVersion",
		"main",
	];
	for (const field of requiredMetadataFields) {
		if (!metadata[field]) {
			errors.push(
				new ValidationError(
					`Missing required metadata field: ${field}`,
					`${metadataPath}.${field}`,
				),
			);
		}
	}

	// Required top-level fields
	const requiredFields = ["downloadUrl", "repository"];
	for (const field of requiredFields) {
		if (!plugin[field]) {
			errors.push(new ValidationError(`Missing required field: ${field}`, `${path}.${field}`));
		}
	}

	// Validate ID format (allow dots for reverse domain notation)
	if (metadata.id && !/^[a-z0-9.-]+$/.test(metadata.id)) {
		errors.push(
			new ValidationError(
				`Invalid plugin ID: ${metadata.id}. Must be lowercase alphanumeric with dots and hyphens only`,
				`${metadataPath}.id`,
			),
		);
	}

	// Validate version
	if (metadata.version && !validateSemver(metadata.version)) {
		errors.push(
			new ValidationError(
				`Invalid version: ${metadata.version}. Must be valid semver (e.g., 1.0.0)`,
				`${metadataPath}.version`,
			),
		);
	}

	// Validate type
	const validTypes = ["provider", "extension", "integration"];
	if (metadata.type && !validTypes.includes(metadata.type)) {
		errors.push(
			new ValidationError(
				`Invalid type: ${metadata.type}. Must be one of: ${validTypes.join(", ")}`,
				`${metadataPath}.type`,
			),
		);
	}

	// Validate permissions array
	if (metadata.permissions) {
		if (!Array.isArray(metadata.permissions)) {
			errors.push(
				new ValidationError("permissions must be an array", `${metadataPath}.permissions`),
			);
		}
	}

	// Validate downloadUrl (must be HTTPS)
	if (plugin.downloadUrl && !validateUrl(plugin.downloadUrl, true)) {
		errors.push(
			new ValidationError(
				`Invalid or non-HTTPS downloadUrl: ${plugin.downloadUrl}`,
				`${path}.downloadUrl`,
			),
		);
	}

	// Validate repository URL
	if (plugin.repository && !validateUrl(plugin.repository, false)) {
		errors.push(
			new ValidationError(`Invalid repository URL: ${plugin.repository}`, `${path}.repository`),
		);
	}

	// Validate optional metadata URLs
	const metadataUrlFields = ["homepage", "repository"];
	for (const field of metadataUrlFields) {
		if (metadata[field] && !validateUrl(metadata[field], false)) {
			errors.push(
				new ValidationError(
					`Invalid metadata ${field} URL: ${metadata[field]}`,
					`${metadataPath}.${field}`,
				),
			);
		}
	}

	// Validate optional top-level URLs
	const urlFields = ["homepage", "icon", "readme", "changelog"];
	for (const field of urlFields) {
		if (plugin[field] && !validateUrl(plugin[field], false)) {
			errors.push(
				new ValidationError(`Invalid ${field} URL: ${plugin[field]}`, `${path}.${field}`),
			);
		}
	}

	// Validate screenshots array
	if (plugin.screenshots) {
		if (!Array.isArray(plugin.screenshots)) {
			errors.push(new ValidationError("screenshots must be an array", `${path}.screenshots`));
		} else {
			plugin.screenshots.forEach((url, i) => {
				if (!validateUrl(url, false)) {
					errors.push(
						new ValidationError(`Invalid screenshot URL: ${url}`, `${path}.screenshots[${i}]`),
					);
				}
			});
		}
	}

	// Validate tags array
	if (metadata.tags) {
		if (!Array.isArray(metadata.tags)) {
			errors.push(new ValidationError("tags must be an array", `${metadataPath}.tags`));
		} else if (metadata.tags.length === 0) {
			errors.push(
				new ValidationError("tags array should not be empty if provided", `${metadataPath}.tags`),
			);
		}
	}

	// Validate numeric fields
	if (
		plugin.downloads !== undefined &&
		(typeof plugin.downloads !== "number" || plugin.downloads < 0)
	) {
		errors.push(
			new ValidationError(`downloads must be a non-negative number`, `${path}.downloads`),
		);
	}

	if (
		plugin.rating !== undefined &&
		(typeof plugin.rating !== "number" || plugin.rating < 0 || plugin.rating > 5)
	) {
		errors.push(new ValidationError(`rating must be a number between 0 and 5`, `${path}.rating`));
	}

	if (
		plugin.ratingCount !== undefined &&
		(typeof plugin.ratingCount !== "number" || plugin.ratingCount < 0)
	) {
		errors.push(
			new ValidationError(`ratingCount must be a non-negative number`, `${path}.ratingCount`),
		);
	}

	// Validate dates
	const dateFields = ["publishedAt", "updatedAt"];
	for (const field of dateFields) {
		if (plugin[field]) {
			const date = new Date(plugin[field]);
			if (isNaN(date.getTime())) {
				errors.push(
					new ValidationError(
						`Invalid ${field}: ${plugin[field]}. Must be valid ISO 8601 date`,
						`${path}.${field}`,
					),
				);
			}
		}
	}

	return errors;
}

async function validateRegistry() {
	console.log("🔍 Validating plugin registry...\n");

	try {
		// Load registry
		const registry = await loadJSON(REGISTRY_PATH);

		const errors = [];
		const warnings = [];

		// Validate root fields
		if (!registry.version) {
			errors.push(new ValidationError("Missing required field: version"));
		}

		if (!registry.lastUpdated) {
			errors.push(new ValidationError("Missing required field: lastUpdated"));
		} else {
			const lastUpdated = new Date(registry.lastUpdated);
			if (isNaN(lastUpdated.getTime())) {
				errors.push(new ValidationError(`Invalid lastUpdated date: ${registry.lastUpdated}`));
			}
		}

		if (!Array.isArray(registry.plugins)) {
			errors.push(new ValidationError("plugins must be an array"));
			// Can't continue validation without valid plugins array
			throw errors[0];
		}

		// Track unique IDs
		const seenIds = new Set();

		// Validate each plugin
		for (let i = 0; i < registry.plugins.length; i++) {
			const plugin = registry.plugins[i];

			// Check for duplicate IDs
			if (plugin.metadata && plugin.metadata.id) {
				if (seenIds.has(plugin.metadata.id)) {
					errors.push(
						new ValidationError(
							`Duplicate plugin ID: ${plugin.metadata.id}`,
							`plugins[${i}].metadata.id`,
						),
					);
				}
				seenIds.add(plugin.metadata.id);
			}

			// Validate plugin
			const pluginErrors = validatePlugin(plugin, i);
			errors.push(...pluginErrors);

			// Warnings
			const pluginId = plugin.metadata?.id || i;
			if (!plugin.icon) {
				warnings.push(`Plugin ${pluginId} has no icon`);
			}

			if (!plugin.metadata?.tags || plugin.metadata.tags.length === 0) {
				warnings.push(`Plugin ${pluginId} has no tags`);
			}
		}

		// Report results
		if (errors.length > 0) {
			console.error("❌ Validation failed with errors:\n");
			errors.forEach((error, i) => {
				console.error(`  ${i + 1}. ${error.message}`);
				if (error.path) {
					console.error(`     at ${error.path}`);
				}
			});
			console.error(`\n❌ Found ${errors.length} error(s)`);
			process.exit(1);
		}

		if (warnings.length > 0) {
			console.warn("⚠️  Warnings:\n");
			warnings.forEach((warning, i) => {
				console.warn(`  ${i + 1}. ${warning}`);
			});
			console.warn(`\n⚠️  Found ${warnings.length} warning(s)\n`);
		}

		console.log(`✅ Validation successful!`);
		console.log(`   - Version: ${registry.version}`);
		console.log(`   - Plugins: ${registry.plugins.length}`);
		console.log(`   - Last updated: ${registry.lastUpdated}\n`);
	} catch (error) {
		if (error instanceof ValidationError) {
			console.error(`❌ ${error.message}`);
			if (error.path) {
				console.error(`   at ${error.path}`);
			}
		} else {
			console.error(`❌ Validation failed: ${error.message}`);
		}
		process.exit(1);
	}
}

// Run validation
validateRegistry();
