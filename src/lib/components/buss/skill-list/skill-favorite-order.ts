import type { Skill } from "@shared/storage/code-agent";

interface SkillDisplayMeta {
	skill: Skill;
	isFavorite: boolean;
	manualImportAt: number | null;
}

function getManualImportTimestamp(value: string | undefined) {
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
	if (a.isFavorite !== b.isFavorite) {
		return a.isFavorite ? -1 : 1;
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
): Skill[] {
	return skills
		.map((skill) => {
			const overriddenFavorite = favoriteOverrides.get(skill.name);
			const isFavorite = overriddenFavorite ?? skill.is_favorite ?? false;

			return {
				skill:
					isFavorite === (skill.is_favorite ?? false)
						? skill
						: { ...skill, is_favorite: isFavorite },
				isFavorite,
				manualImportAt: getManualImportTimestamp(skill.manual_import_at),
			};
		})
		.sort(compareSkillDisplayOrder)
		.map(({ skill }) => skill);
}
