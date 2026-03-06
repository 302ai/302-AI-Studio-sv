import type { Model } from "@shared/types";

/**
 * 检查模型是否被用户添加
 */
function isModelAddedByUser(model: Model): boolean {
	return model.isAddedByUser === true;
}

/**
 * 检查模型是否为精选模型
 * 如果 isFeatured 字段不存在，默认返回 true（兼容旧数据）
 */
function isModelFeatured(model: Model): boolean {
	return model.isFeatured !== false;
}

/**
 * 获取过滤后的模型列表
 * @param models - 模型列表
 * @param enabledOnly - 是否只返回已启用的模型（默认 false）
 * @param openaiCompatible - 是否返回openai规范的模型（默认 false）
 * @returns 过滤后的模型列表
 * @description 对于 302AI provider 的模型，只返回 isFeatured === true 或 isAddedByUser === true 的模型；其他 provider 不应用此过滤
 */
export function getFilteredModels(
	models: Model[],
	enabledOnly: boolean = false,
	openaiCompatible: boolean = false,
): Model[] {
	return models.filter((m) => {
		if (enabledOnly && !m.enabled) return false;
		// 对于 302AI provider 的模型，应用过滤条件：只显示 isFeatured === true 或 isAddedByUser === true 的模型
		if (m.providerId === "302AI") {
			return (
				(isModelFeatured(m) || isModelAddedByUser(m)) &&
				(!openaiCompatible || m.openai_compatible === openaiCompatible)
			);
		}
		// 其他 provider 不应用过滤条件，返回所有模型
		return true;
	});
}

/**
 * 获取可用于下拉列表的模型ID列表：只包含 isFeatured === false && isAddedByUser === false 的模型
 * @param models - 模型列表
 * @param providerId - Provider ID
 * @returns 模型ID列表（已去重并排序）
 */
export function getAvailableModelIdsForDropdown(models: Model[], providerId: string): string[] {
	const allModels = models.filter((m) => {
		if (m.providerId !== providerId) return false;
		if (isModelFeatured(m)) return false;
		return m.isAddedByUser === false || m.isAddedByUser === undefined;
	});
	// 去重并按名称排序
	return Array.from(new Set(allModels.map((m) => m.id))).sort();
}
