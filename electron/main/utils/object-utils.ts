import { cloneDeep } from "es-toolkit/compat";

/**
 * Check whether a dot-path should be force-overridden.
 *
 * Matching rules:
 * - Exact match:  "a.b" matches "a.b"
 * - Child match:  "a.b.c" matches override "a.b" (overriding a parent covers all children)
 */
export function shouldOverride(currentPath: string, overridePaths: string[]): boolean {
	if (overridePaths.length === 0) return false;

	return overridePaths.some((overridePath) => {
		if (currentPath === overridePath) return true;
		if (currentPath.startsWith(overridePath + ".")) return true;
		return false;
	});
}

/**
 * Smart array merge with optional identity-based deduplication.
 *
 * - With `getIdentity`: objects are deduplied by key (e.g. `item => item.id`).
 * - Without: primitives are deduplied via `Set`.
 */
export function mergeArrays<T>(target: T[], source: T[], getIdentity?: (item: T) => unknown): T[] {
	if (!Array.isArray(target) || !Array.isArray(source)) {
		return source;
	}
	if (target.length === 0) return [...source];
	if (source.length === 0) return [...target];

	if (!getIdentity) {
		const existingSet = new Set(target);
		return [...target, ...source.filter((item) => !existingSet.has(item))];
	}

	const existingIds = new Set(target.map(getIdentity));
	return [...target, ...source.filter((item) => !existingIds.has(getIdentity(item)))];
}

/**
 * Deep merge `source` into `target` with selective force-override support.
 *
 * Behaviour per key:
 * 1. Key missing in target           → clone from source
 * 2. Path listed in `overridePaths`  → clone from source (force)
 * 3. Both values are arrays          → smart merge (deduplicate by `id` if objects)
 * 4. Both values are plain objects   → recurse
 * 5. Otherwise                       → keep target value (user config wins)
 *
 * @returns The mutated `target` object.
 */
export function deepMergeWithOverride(
	target: Record<string, unknown>,
	source: Record<string, unknown>,
	overridePaths: string[] = [],
	currentPath = "",
): Record<string, unknown> {
	for (const key of Object.keys(source)) {
		const sourceValue = source[key];
		const targetValue = target[key];
		const newPath = currentPath ? `${currentPath}.${key}` : key;

		// Case 1: target does not have this key → add it
		if (!(key in target)) {
			target[key] = cloneDeep(sourceValue);
			continue;
		}

		// Case 2: force-override path → replace with source
		if (shouldOverride(newPath, overridePaths)) {
			target[key] = cloneDeep(sourceValue);
			continue;
		}

		// Case 3: both arrays → smart merge
		if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
			// Detect object arrays with `id` field for identity-based dedup
			const hasIdField =
				sourceValue.length > 0 &&
				typeof sourceValue[0] === "object" &&
				sourceValue[0] !== null &&
				"id" in sourceValue[0];

			target[key] = hasIdField
				? mergeArrays(
						targetValue as Array<Record<string, unknown>>,
						sourceValue as Array<Record<string, unknown>>,
						(item) => item.id,
					)
				: mergeArrays(targetValue, sourceValue);
			continue;
		}

		// Case 4: both plain objects → recurse
		if (
			typeof sourceValue === "object" &&
			sourceValue !== null &&
			!Array.isArray(sourceValue) &&
			typeof targetValue === "object" &&
			targetValue !== null &&
			!Array.isArray(targetValue)
		) {
			deepMergeWithOverride(
				targetValue as Record<string, unknown>,
				sourceValue as Record<string, unknown>,
				overridePaths,
				newPath,
			);
			continue;
		}

		// Case 5: primitive mismatch → keep target (user config wins)
	}

	return target;
}

/**
 * Return a shallow copy of `obj` with all keys matching any of the given
 * prefixes removed.
 */
export function omitByPrefix<T extends Record<string, unknown>>(
	obj: T,
	prefixes: string[],
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (!prefixes.some((prefix) => key.startsWith(prefix))) {
			result[key] = value;
		}
	}
	return result;
}
