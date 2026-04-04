import { toast_download_failed, toast_download_file_missing } from "$lib/paraglide/messages";

const SANDBOX_DOWNLOAD_FILE_MISSING_PATTERNS = [
	"path not found",
	"no such file or directory",
	"does not exist",
] as const;

function getSafeLocalizedMessage(getMessage: () => string, fallback: string): string {
	try {
		return getMessage();
	} catch {
		return fallback;
	}
}

export function isSandboxDownloadFileMissingError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	const normalizedMessage = error.message.toLowerCase();
	return SANDBOX_DOWNLOAD_FILE_MISSING_PATTERNS.some((pattern) =>
		normalizedMessage.includes(pattern),
	);
}

export function getSandboxDownloadErrorMessage(error: unknown): string {
	if (isSandboxDownloadFileMissingError(error)) {
		return typeof toast_download_file_missing === "function"
			? getSafeLocalizedMessage(toast_download_file_missing, "文件不存在或已被删除")
			: "文件不存在或已被删除";
	}

	if (error instanceof Error && error.message) {
		return error.message;
	}

	return typeof toast_download_failed === "function"
		? getSafeLocalizedMessage(toast_download_failed, "下载失败")
		: "下载失败";
}
