import { type Plugin, type ResolvedConfig } from "vite";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { TypeScriptServiceParser } from "./parser";
import { IpcStructureGenerator } from "./generator";
import type { IpcServiceGeneratorOptions } from "./types";

/**
 * IPC service generator Vite plugin
 * Automatically generates Preload scripts and main process registration code for Electron IPC services
 */
export function ipcServiceGenerator(options: IpcServiceGeneratorOptions = {}): Plugin {
	const {
		servicesDir = "electron/main/services",
		outputDir = "electron/main/generated",
		formatCommand = false,
	} = options;

	/**
	 * Format TypeScript files using the specified command in parallel
	 */
	function formatFiles(filePaths: string[], projectRoot: string): void {
		if (formatCommand === false || filePaths.length === 0) {
			return;
		}

		// Execute format commands in parallel using Promise.allSettled
		const formatPromises = filePaths.map(async (filePath) => {
			try {
				await new Promise<void>((resolve, reject) => {
					const child = spawn(
						formatCommand.split(" ")[0],
						[...formatCommand.split(" ").slice(1), filePath],
						{
							cwd: projectRoot,
							stdio: "pipe",
						},
					);

					child.on("close", (code: number) => {
						if (code === 0) {
							resolve();
						} else {
							reject(new Error(`Format command exited with code ${code}`));
						}
					});

					child.on("error", reject);
				});

				console.log(`🎨 Formatted: ${path.relative(projectRoot, filePath)}`);
				return { status: "fulfilled", filePath };
			} catch (error) {
				console.warn(
					`⚠️  Failed to format ${path.relative(projectRoot, filePath)}:`,
					error instanceof Error ? error.message : "Unknown error",
				);
				return { status: "rejected", filePath, error };
			}
		});

		// Wait for all format operations to complete
		Promise.allSettled(formatPromises).then((results) => {
			const successful = results.filter((r) => r.status === "fulfilled").length;
			const failed = results.filter((r) => r.status === "rejected").length;

			if (successful > 0) {
				console.log(`✅ Successfully formatted ${successful} file(s)`);
			}
			if (failed > 0) {
				console.warn(`⚠️  Failed to format ${failed} file(s)`);
			}
		});
	}

	function generateFiles(config: ResolvedConfig) {
		const resolvedServicesDir = path.resolve(config.root, servicesDir);
		const resolvedOutputDir = path.resolve(config.root, outputDir);

		console.log(`🔍 IPC Service Generator: Scanning directory ${resolvedServicesDir}`);

		try {
			const parser = new TypeScriptServiceParser(resolvedServicesDir);
			const methods = parser.parseServices();

			console.log(`📸 Found ${methods.length} methods containing _event parameters`);

			if (methods.length === 0) {
				console.log("ℹ️  No methods containing _event parameters found, skipping generation");
				return;
			}

			const generator = new IpcStructureGenerator(methods, options, {
				servicesDir: resolvedServicesDir,
				outputDir: resolvedOutputDir,
			});
			const structure = generator.generateStructure();

			if (!fs.existsSync(resolvedOutputDir)) {
				fs.mkdirSync(resolvedOutputDir, { recursive: true });
			}

			// Generate importable service module
			const servicesModuleCode = generator.generatePreloadServicesModule(structure);
			const servicesModuleFile = path.join(resolvedOutputDir, "preload-services.ts");
			fs.writeFileSync(servicesModuleFile, servicesModuleCode);

			// Generate main process registration code
			const mainCode = generator.generateMainProcessCode(structure);
			const mainFile = path.join(resolvedOutputDir, "ipc-registration.ts");
			fs.writeFileSync(mainFile, mainCode);

			// Format all generated files in parallel
			formatFiles([servicesModuleFile, mainFile], config.root);

			console.log(`✅ IPC structure generated:`);
			console.log(`├─ 📦 Service module: ${path.relative(config.root, servicesModuleFile)}`);
			console.log(`├─ ⚙️ Main process registration: ${path.relative(config.root, mainFile)}`);
			console.log(`├─ 📊 Service count: ${structure.services.length}`);

			structure.services.forEach((service) => {
				console.log(
					`└─ 🏷️ ${service.serviceName} (${service.className}): ${service.methods.length} methods`,
				);
				service.methods.forEach((method, index) => {
					const params = method.parameters.map((p) => `${p.name}: ${p.type}`).join(", ");
					const isLast = index === service.methods.length - 1;
					const prefix = isLast ? "└─" : "├─";
					console.log(`│   ${prefix} 📎 ${method.methodName}(${params}) ➡️ ${method.channelName}`);
				});
			});
		} catch (error) {
			console.error("❌ IPC Service Generator Error:", error);
			if (error instanceof Error) {
				console.error("Detailed error:", error.message);
			}
		}
	}

	let config: ResolvedConfig;

	return {
		name: "ipc-service-generator",
		configResolved(resolvedConfig) {
			config = resolvedConfig;
		},
		buildStart() {
			// Generate files at the start of build
			generateFiles(config);
		},
		handleHotUpdate(ctx) {
			// Only handle TypeScript files in the services directory
			if (ctx.file.includes(servicesDir) && ctx.file.endsWith(".ts")) {
				console.log(
					`🔄 Service file updated, regenerating IPC structure: ${path.relative(config.root, ctx.file)}`,
				);
				generateFiles(config);
			}
		},
	};
}

export default ipcServiceGenerator;
