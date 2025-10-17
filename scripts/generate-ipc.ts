#!/usr/bin/env tsx

import * as fs from "fs";
import * as path from "path";
import { IpcStructureGenerator } from "../vite-plugins/ipc-service-generator/generator";
import { TypeScriptServiceParser } from "../vite-plugins/ipc-service-generator/parser";
import type { IpcServiceGeneratorOptions } from "../vite-plugins/ipc-service-generator/types";

/**
 * Standalone script to generate IPC service code
 * This script runs the ipc-service-generator independently of Vite
 */
async function generateIpcServices() {
	const projectRoot = process.cwd();

	// Configuration matching vite.config.ts
	const options: IpcServiceGeneratorOptions = {
		servicesDir: "electron/main/services",
		outputDir: "electron/main/generated",
		formatCommand: "pnpm prettier --write",
	};

	const { servicesDir, outputDir } = options;
	const resolvedServicesDir = path.resolve(projectRoot, servicesDir ?? "electron/main/services");
	const resolvedOutputDir = path.resolve(projectRoot, outputDir ?? "electron/main/generated");

	console.log(`🔍 IPC Service Generator: Scanning directory ${resolvedServicesDir}`);

	try {
		// Check if services directory exists
		if (!fs.existsSync(resolvedServicesDir)) {
			console.error(`❌ Services directory does not exist: ${resolvedServicesDir}`);
			process.exit(1);
		}

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

		// Create output directory if it doesn't exist
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

		console.log(`✅ IPC structure generated:`);
		console.log(`├─ 📦 Service module: ${path.relative(projectRoot, servicesModuleFile)}`);
		console.log(`├─ ⚙️ Main process registration: ${path.relative(projectRoot, mainFile)}`);
		console.log(`├─ 📊 Service count: ${structure.services.length}`);

		structure.services.forEach((service) => {
			console.log(
				`└─ 🏷️ ${service.serviceName} (${service.className}): ${service.methods.length} methods`,
			);
			service.methods.forEach((method, index) => {
				const genericString =
					method.genericParameters.length > 0
						? `<${method.genericParameters.map((p) => `${p.name}${p.defaultType ? ` = ${p.defaultType}` : ""}`).join(", ")}>`
						: "";
				const params = method.parameters.map((p) => `${p.name}: ${p.type}`).join(", ");
				const isLast = index === service.methods.length - 1;
				const prefix = isLast ? "└─" : "├─";
				console.log(
					`│   ${prefix} 📎 ${method.methodName}${genericString}(${params}) ➡️ ${method.channelName}`,
				);
			});
		});

		// Format generated files
		if (options.formatCommand) {
			console.log(`🎨 Formatting generated files...`);
			const { spawn } = await import("child_process");

			const filesToFormat = [servicesModuleFile, mainFile];

			for (const file of filesToFormat) {
				try {
					const commandParts = options.formatCommand.split(" ");
					const command = commandParts[0];
					const args = [...commandParts.slice(1), file];

					await new Promise<void>((resolve, reject) => {
						const isWindows = process.platform === "win32";
						const child = spawn(
							isWindows ? "cmd" : command,
							isWindows ? ["/c", command, ...args] : args,
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

					console.log(`🎨 Formatted: ${path.relative(projectRoot, file)}`);
				} catch (error) {
					console.warn(
						`⚠️  Failed to format ${path.relative(projectRoot, file)}:`,
						error instanceof Error ? error.message : "Unknown error",
					);
				}
			}
		}

		console.log(`🎉 IPC service generation completed successfully!`);
	} catch (error) {
		console.error("❌ IPC Service Generator Error:", error);
		if (error instanceof Error) {
			console.error("Detailed error:", error.message);
		}
		process.exit(1);
	}
}

// Run the script
generateIpcServices().catch((error) => {
	console.error("Failed to generate IPC services:", error);
	process.exit(1);
});
