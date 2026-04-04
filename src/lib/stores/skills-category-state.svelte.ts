/**
 * Skills Category State Management
 *
 * 管理 Skills 分类数据的获取和缓存
 * 支持国际化的分类名称展示
 */

import {
	type Category,
	getCategoriesByNames,
	listCategories,
} from "$lib/api/skills/skills-market-api";
import { getLocale } from "$lib/paraglide/runtime";
import { createLogger } from "@shared/logger";

const logger = createLogger("state");
import type { Skill } from "@shared/types";
import { SvelteMap } from "svelte/reactivity";

// 未分类的特殊slug
export const UNCATEGORIZED_SLUG = "__uncategorized__";

class SkillsCategoryState {
	// 所有分类列表（带国际化名称）
	categories = $state<Category[]>([]);

	// skills对应的分类信息映射 (skillName -> category)
	skillCategoryMap = $state(new SvelteMap<string, Category | null>());

	// 加载状态
	isLoadingCategories = $state(false);
	isLoadingSkillCategories = $state(false);

	// 缓存的locale，用于检测语言变化
	private cachedLocale = $state<string | null>(null);

	// 当前选中的分类slug（用于筛选）
	selectedCategorySlug = $state<string | null>(null);

	// 获取当前locale
	private getApiLocale(): "en" | "zh" {
		const locale = getLocale();
		return locale === "zh" ? "zh" : "en";
	}

	/**
	 * 获取所有分类列表
	 */
	async fetchCategories() {
		const currentLocale = this.getApiLocale();

		// 如果已有数据且语言未变，不重复请求
		if (this.categories.length > 0 && this.cachedLocale === currentLocale) {
			return;
		}

		this.isLoadingCategories = true;
		try {
			const categories = await listCategories(currentLocale);
			this.categories = categories;
			this.cachedLocale = currentLocale;
		} catch (error) {
			logger.error("Failed to fetch categories:", error);
		} finally {
			this.isLoadingCategories = false;
		}
	}

	/**
	 * 为skills获取分类信息
	 */
	async fetchSkillCategories(skills: Skill[]) {
		const currentLocale = this.getApiLocale();
		const skillNames = skills.map((s) => s.name);

		// 筛选出还没有缓存的skill names
		const uncachedNames = skillNames.filter((name) => !this.skillCategoryMap.has(name));

		if (uncachedNames.length === 0) {
			return;
		}

		this.isLoadingSkillCategories = true;
		try {
			const categoryInfos = await getCategoriesByNames(uncachedNames, currentLocale);

			// 更新映射
			for (const info of categoryInfos) {
				this.skillCategoryMap.set(info.skillName, info.category);
			}
		} catch (error) {
			logger.error("Failed to fetch skill categories:", error);
		} finally {
			this.isLoadingSkillCategories = false;
		}
	}

	/**
	 * 获取skill的分类信息
	 */
	getSkillCategory(skillName: string): Category | null | undefined {
		return this.skillCategoryMap.get(skillName);
	}

	/**
	 * 将skills按分类分组
	 */
	groupSkillsByCategory(
		skills: Skill[],
	): SvelteMap<string, { category: Category | null; skills: Skill[] }> {
		const groups = new SvelteMap<string, { category: Category | null; skills: Skill[] }>();

		for (const skill of skills) {
			const category = this.skillCategoryMap.get(skill.name);
			const slug = category?.slug ?? UNCATEGORIZED_SLUG;

			if (!groups.has(slug)) {
				groups.set(slug, {
					category: category ?? null,
					skills: [],
				});
			}
			groups.get(slug)!.skills.push(skill);
		}

		return groups;
	}

	/**
	 * 选择分类进行筛选
	 */
	selectCategory(slug: string | null) {
		this.selectedCategorySlug = slug;
	}

	/**
	 * 清除分类筛选
	 */
	clearCategoryFilter() {
		this.selectedCategorySlug = null;
	}

	/**
	 * 重置状态（语言切换时调用）
	 */
	reset() {
		this.categories = [];
		this.skillCategoryMap = new SvelteMap();
		this.cachedLocale = null;
		this.selectedCategorySlug = null;
	}

	/**
	 * 检查并刷新（如果语言变化）
	 */
	async checkAndRefresh(skills: Skill[]) {
		const currentLocale = this.getApiLocale();

		if (this.cachedLocale !== currentLocale) {
			// 语言变化，重新获取数据
			this.skillCategoryMap = new SvelteMap();
			await Promise.all([this.fetchCategories(), this.fetchSkillCategories(skills)]);
		}
	}
}

export const skillsCategoryState = new SkillsCategoryState();
