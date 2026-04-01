import type { Skill } from "@shared/storage/code-agent";

interface SkillDisplayMeta {
	skill: Skill;
	favoriteAt: number | null;
	manualImportAt: number | null;
}

function getSkillTimestamp(value: string | null | undefined) {
	if (!value) {
		return null;
	}

	const timestamp = Date.parse(value);
	return Number.isNaN(timestamp) ? null : timestamp;
}

function compareSkillName(a: string, b: string) {
	if (a === b) {
		return 0;
	}

	return a < b ? -1 : 1;
}

function compareSkillDisplayOrder(a: SkillDisplayMeta, b: SkillDisplayMeta) {
	if (a.favoriteAt !== b.favoriteAt) {
		if (a.favoriteAt === null) {
			return 1;
		}
		if (b.favoriteAt === null) {
			return -1;
		}

		return b.favoriteAt - a.favoriteAt;
	}

	if (a.manualImportAt !== b.manualImportAt) {
		if (a.manualImportAt === null) {
			return 1;
		}
		if (b.manualImportAt === null) {
			return -1;
		}

		return b.manualImportAt - a.manualImportAt;
	}

	return compareSkillName(a.skill.name, b.skill.name);
}

export function getOrderedSkillsByFavorite(
	skills: Skill[],
	favoriteOverrides: ReadonlyMap<string, boolean>,
	favoriteAtOverrides: ReadonlyMap<string, string | null>,
): Skill[] {
	return skills
		.map((skill) => {
			const overriddenFavorite = favoriteOverrides.get(skill.name);
			const isFavorite = overriddenFavorite ?? skill.is_favorite ?? false;
			const overriddenFavoriteAt = favoriteAtOverrides.get(skill.name);
			const favoriteAt = isFavorite
				? (overriddenFavoriteAt ?? skill.favorite_at ?? null)
				: null;
			const hasFavoriteChanged = isFavorite !== (skill.is_favorite ?? false);
			const hasFavoriteAtChanged = favoriteAt !== (skill.favorite_at ?? null);

			return {
				skill:
					hasFavoriteChanged || hasFavoriteAtChanged
						? { ...skill, is_favorite: isFavorite, favorite_at: favoriteAt }
						: skill,
				favoriteAt: getSkillTimestamp(favoriteAt),
				manualImportAt: getSkillTimestamp(skill.manual_import_at),
			};
		})
		.sort(compareSkillDisplayOrder)
		.map(({ skill }) => skill);
}
