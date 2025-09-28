import { readFileSync } from "node:fs";
import { parse } from "superjson";
import { match, P } from "ts-pattern";

export function getAdditionalArgv(key: string) {
	for (const arg of process.argv) {
		const result = match(arg)
			.with(P.string.startsWith(`--${key}=`), (matchedArg) => matchedArg.split("=")[1])
			.otherwise(() => null);

		if (result !== null) {
			return result;
		}
	}
	return null;
}

export function loadDataFromTempFile(filePath?: string) {
	if (!filePath) return null;

	try {
		const serializedData = readFileSync(filePath, "utf8");
		return parse(serializedData);
	} catch (error) {
		console.error("Failed to load data from temp file:", filePath, error);
		return null;
	}
}
