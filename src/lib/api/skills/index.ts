import JSZip from "jszip";
import type {
	DeleteSkillRequest,
	ListSkillsRequest,
	ListSkillsResponse,
	SkillDetailsRequest,
} from "./base-apis";
import {
	addSkillFavorite,
	cancelSkillFavorite,
	_createSkill,
	_createSkillFromGitHub,
	_editSkillDetails,
	_listSkills,
	deleteSkill,
} from "./base-apis";

const { extractZipBlob, zipDirectory } = window.electronAPI.appService;

export async function editSkillDetails(request: SkillDetailsRequest) {
	const blob = await _editSkillDetails(request);
	const arrayBuffer = await blob.arrayBuffer();
	const path = await extractZipBlob(arrayBuffer);
	return path;
}

export async function downloadSkill(skillName: string, builtin: boolean = false): Promise<Blob> {
	return _editSkillDetails({ skillName, builtin });
}

export async function listSkills(request: ListSkillsRequest): Promise<ListSkillsResponse> {
	const pipeline = (response: ListSkillsResponse) => {
		const { success, user_skills, builtin_skills, project_skills } = response;
		return {
			success,
			user_skills: user_skills.map((skill) => ({
				...skill,
				isBuiltin: false,
				is_favorite: skill.is_favorite ?? false,
			})),
			builtin_skills: builtin_skills.map((skill) => ({
				...skill,
				isBuiltin: true,
				is_favorite: skill.is_favorite ?? false,
			})),
			project_skills: project_skills.map((skill) => ({
				...skill,
				isBuiltin: false,
				is_favorite: skill.is_favorite ?? false,
			})),
		};
	};

	const result = await _listSkills(request);
	return pipeline(result);
}

export interface CreateSkillData {
	name: string;
	description: string;
	content: string;
}

export async function createSkill(data: CreateSkillData) {
	const { name, content } = data;

	// 创建 zip 文件，文件夹名与 skill 名一致
	const zip = new JSZip();
	const folder = zip.folder(name);
	if (!folder) {
		throw new Error("Failed to create skill folder in zip");
	}
	folder.file("SKILL.md", content);

	const zipBlob = await zip.generateAsync({ type: "blob" });
	const zipFile = new File([zipBlob], `${name}.zip`, { type: "application/zip" });

	return _createSkill(zipFile);
}

export interface UpdateSkillData {
	name: string;
	dirPath: string; // 包含修改后文件的目录路径
}

/**
 * 更新 skill，将目录打包成 zip 并上传
 * zip 文件名使用 skill 名称，内部文件夹名保持原样
 */
export async function updateSkill(data: UpdateSkillData) {
	const { name, dirPath } = data;

	// 获取原始文件夹名
	const originalFolderName = dirPath.split(/[/\\]/).pop() || name;

	// 使用 electron 的 zipDirectory 打包目录，保持原始文件夹名
	const zipArrayBuffer = await zipDirectory(dirPath, originalFolderName);
	const zipBlob = new Blob([zipArrayBuffer], { type: "application/zip" });
	const zipFile = new File([zipBlob], `${name}.zip`, { type: "application/zip" });

	return _createSkill(zipFile);
}

export async function createSkillFromGitHub(githubUrl: string) {
	return _createSkillFromGitHub(githubUrl);
}

export { addSkillFavorite, cancelSkillFavorite };
export type { DeleteSkillRequest };
export { deleteSkill };
