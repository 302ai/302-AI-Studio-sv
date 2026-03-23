import type { Skill } from "@shared/types";

export function isOpenClawBundledSkill(skill?: Skill | null): boolean {
	if (!skill) {
		return false;
	}

	return skill.source === "openclaw-bundled" || skill.bundled === true;
}
