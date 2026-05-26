/**
 * Skills Market REST API
 * https://api-skills.302ai.cn
 *
 * This API provides:
 * - Category listing with i18n support
 * - Batch skill categorization
 * - Individual skill details
 */

import { createLogger } from "@shared/logger";
import { type } from "arktype";

const logger = createLogger("apis");

const SKILLS_MARKET_BASE_URL = "https://api-skills.302ai.cn";

// ============== Types ==============

export const categorySchema = type({
	id: "string",
	slug: "string",
	name: "string",
	skillCount: "number?",
});
export type Category = typeof categorySchema.infer;

export const skillCategoryInfoSchema = type({
	skillName: "string",
	category: type({
		id: "string",
		slug: "string",
		name: "string",
	}).or("null"),
});
export type SkillCategoryInfo = typeof skillCategoryInfoSchema.infer;

export const skillMarketDetailSchema = type({
	id: "string",
	name: "string",
	author: "string",
	stars: "number",
	tags: "string[]",
	isFeatured: "boolean",
	githubUrl: "string",
	downloadUrl: "string|null",
	publishedAt: "string",
	description: "string",
	category: "string",
	detailedDescription: "string|null",
	usageInstructions: "string[]|null",
	viewCount: "number",
	downloadCount: "number",
	coverImageUrl: "string|null",
});
export type SkillMarketDetail = typeof skillMarketDetailSchema.infer;

// ============== API Functions ==============

/**
 * Get all categories list with i18n support
 * GET /api/categories?locale=zh
 * @param locale - Language code: "en" (default) or "zh"
 */
export async function listCategories(locale: "en" | "zh" = "en"): Promise<Category[]> {
	try {
		const url = new URL(`${SKILLS_MARKET_BASE_URL}/api/categories`);
		url.searchParams.set("locale", locale);

		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				Accept: "application/json",
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch categories: ${response.status}`);
		}

		const data = await response.json();
		return data as Category[];
	} catch (error) {
		logger.error("Failed to list categories:", error);
		throw error;
	}
}

/**
 * Get categories for multiple skills by their names
 * GET /api/skills/categories-by-names?names=a&names=b&locale=zh
 * @param names - Array of skill names (1-100)
 * @param locale - Language code: "en" (default) or "zh"
 */
export async function getCategoriesByNames(
	names: string[],
	locale: "en" | "zh" = "en",
): Promise<SkillCategoryInfo[]> {
	if (names.length === 0) {
		return [];
	}

	if (names.length > 100) {
		// Split into batches of 100
		const batches: string[][] = [];
		for (let i = 0; i < names.length; i += 100) {
			batches.push(names.slice(i, i + 100));
		}

		const results = await Promise.all(
			batches.map((batch) => getCategoriesByNames(batch, locale)),
		);

		return results.flat();
	}

	try {
		const url = new URL(`${SKILLS_MARKET_BASE_URL}/api/skills/categories-by-names`);
		// Use bracket notation so the backend always parses names as an array,
		// even when there is only a single value
		for (const name of names) {
			url.searchParams.append("names[]", name);
		}
		url.searchParams.set("locale", locale);

		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				Accept: "application/json",
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch skill categories: ${response.status}`);
		}

		const data = await response.json();
		return data as SkillCategoryInfo[];
	} catch (error) {
		logger.error("Failed to get categories by names:", error);
		throw error;
	}
}

/**
 * Get skill detail by name with i18n support
 * GET /api/skills/by-name?name=cursor-memory-bank&locale=zh
 * @param name - Skill name
 * @param locale - Language code: "en" (default) or "zh"
 */
export async function getSkillByName(
	name: string,
	locale: "en" | "zh" = "en",
): Promise<SkillMarketDetail | null> {
	try {
		const url = new URL(`${SKILLS_MARKET_BASE_URL}/api/skills/by-name`);
		url.searchParams.set("name", name);
		url.searchParams.set("locale", locale);

		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				Accept: "application/json",
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch skill detail: ${response.status}`);
		}

		const data = await response.json();
		return data as SkillMarketDetail | null;
	} catch (error) {
		logger.error("Failed to get skill by name:", error);
		throw error;
	}
}
