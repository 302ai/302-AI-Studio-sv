export function getAdditionalArgv(key: string) {
	return process.argv.find((arg) => arg.startsWith(`--${key}=`))?.split("=")[1];
}
