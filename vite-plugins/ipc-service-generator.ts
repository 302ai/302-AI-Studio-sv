import { Plugin } from "vite";
import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";

interface ServiceMethod {
	serviceName: string;
	className: string;
	methodName: string;
	parameters: Array<{
		name: string;
		type: string;
		isEventParam: boolean;
	}>;
	returnType: string;
	filePath: string;
}

interface GeneratedIpcStructure {
	services: Array<{
		serviceName: string;
		className: string;
		filePath: string;
		methods: Array<{
			methodName: string;
			channelName: string;
			parameters: Array<{
				name: string;
				type: string;
			}>;
			returnType: string;
		}>;
	}>;
}

interface IpcServiceGeneratorOptions {
	servicesDir?: string;
	outputDir?: string;
	channelPrefix?: string;
	methodFilter?: (methodName: string) => boolean;
}

class TypeScriptServiceParser {
	private program: ts.Program;
	private checker: ts.TypeChecker;

	constructor(private servicesDir: string) {
		this.setupTypeScriptProgram();
	}

	private setupTypeScriptProgram(): void {
		const configPath = ts.findConfigFile(this.servicesDir, ts.sys.fileExists, "tsconfig.json");

		let compilerOptions: ts.CompilerOptions = {
			target: ts.ScriptTarget.ES2020,
			module: ts.ModuleKind.CommonJS,
			allowJs: true,
			declaration: false,
			emitDeclarationOnly: false,
			noEmit: true,
			strict: false,
			skipLibCheck: true,
		};

		if (configPath) {
			const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
			if (configFile.config) {
				const parsedConfig = ts.parseJsonConfigFileContent(
					configFile.config,
					ts.sys,
					path.dirname(configPath),
				);
				compilerOptions = { ...compilerOptions, ...parsedConfig.options };
			}
		}

		const serviceFiles = this.findServiceFiles();
		this.program = ts.createProgram(serviceFiles, compilerOptions);
		this.checker = this.program.getTypeChecker();
	}

	private findServiceFiles(): string[] {
		const patterns = [
			path.join(this.servicesDir, "**/*.ts").replace(/\\/g, "/"),
			path.join(this.servicesDir, "**/*.js").replace(/\\/g, "/"),
		];

		const files: string[] = [];
		patterns.forEach((pattern) => {
			files.push(...glob.sync(pattern));
		});

		return files.filter((file) => !file.includes(".d.ts"));
	}

	private getServiceName(className: string): string {
		const serviceName = className.replace(/Service$/, "");
		return serviceName.charAt(0).toLowerCase() + serviceName.slice(1);
	}

	private getTypeText(typeNode: ts.TypeNode | undefined): string {
		if (!typeNode) return "any";
		const typeText = typeNode.getText();
		const typeMap: Record<string, string> = {
			"Electron.IpcMainInvokeEvent": "IpcMainInvokeEvent",
			IpcMainInvokeEvent: "IpcMainInvokeEvent",
		};
		return typeMap[typeText] || typeText;
	}

	private isEventParameter(param: ts.ParameterDeclaration): boolean {
		const paramName = param.name.getText();
		if (paramName.includes("_event") || paramName === "event") {
			return true;
		}
		if (param.type) {
			const typeText = this.getTypeText(param.type);
			return typeText.includes("IpcMainInvokeEvent");
		}
		return false;
	}

	private parseMethodParameters(method: ts.MethodDeclaration): Array<{
		name: string;
		type: string;
		isEventParam: boolean;
	}> {
		return method.parameters.map((param) => {
			const name = param.name.getText();
			const type = this.getTypeText(param.type);
			const isEventParam = this.isEventParameter(param);
			return { name, type, isEventParam };
		});
	}

	private parseMethodReturnType(method: ts.MethodDeclaration): string {
		if (method.type) {
			return this.getTypeText(method.type);
		}
		const signature = this.checker.getSignatureFromDeclaration(method);
		if (signature) {
			const returnType = this.checker.getReturnTypeOfSignature(signature);
			return this.checker.typeToString(returnType);
		}
		return "any";
	}

	public parseServices(): ServiceMethod[] {
		const methods: ServiceMethod[] = [];

		for (const sourceFile of this.program.getSourceFiles()) {
			if (sourceFile.isDeclarationFile) continue;
			if (!sourceFile.fileName.includes(this.servicesDir)) continue;

			const filePath = sourceFile.fileName;

			ts.forEachChild(sourceFile, (node) => {
				if (ts.isClassDeclaration(node) && node.name) {
					const className = node.name.text;
					const serviceName = this.getServiceName(className);

					node.members.forEach((member) => {
						if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
							const methodName = member.name.text;
							const parameters = this.parseMethodParameters(member);
							const hasEventParam = parameters.some((p) => p.isEventParam);

							if (hasEventParam) {
								const returnType = this.parseMethodReturnType(member);
								methods.push({
									serviceName,
									className,
									methodName,
									parameters,
									returnType,
									filePath: path.relative(process.cwd(), filePath),
								});
							}
						}
					});
				}
			});
		}

		return methods;
	}
}

class IpcStructureGenerator {
	constructor(
		private methods: ServiceMethod[],
		private options: IpcServiceGeneratorOptions,
	) {}

	private generateChannelName(serviceName: string, methodName: string): string {
		const prefix = this.options.channelPrefix || "";
		return `${prefix}${serviceName}:${methodName}`;
	}

	public generateStructure(): GeneratedIpcStructure {
		const servicesMap = new Map<
			string,
			{
				serviceName: string;
				className: string;
				filePath: string;
				methods: Array<{
					methodName: string;
					channelName: string;
					parameters: Array<{ name: string; type: string }>;
					returnType: string;
				}>;
			}
		>();

		this.methods.forEach((method) => {
			if (this.options.methodFilter && !this.options.methodFilter(method.methodName)) {
				return;
			}

			if (!servicesMap.has(method.serviceName)) {
				servicesMap.set(method.serviceName, {
					serviceName: method.serviceName,
					className: method.className,
					filePath: method.filePath,
					methods: [],
				});
			}

			const service = servicesMap.get(method.serviceName)!;
			const businessParameters = method.parameters
				.filter((p) => !p.isEventParam)
				.map((p) => ({ name: p.name, type: p.type }));

			service.methods.push({
				methodName: method.methodName,
				channelName: this.generateChannelName(method.serviceName, method.methodName),
				parameters: businessParameters,
				returnType: method.returnType,
			});
		});

		return {
			services: Array.from(servicesMap.values()),
		};
	}

	public generatePreloadServicesModule(structure: GeneratedIpcStructure): string {
		const servicesInterface = structure.services
			.map((service) => {
				const methods = service.methods
					.map((method) => {
						const paramTypes =
							method.parameters.length > 0
								? method.parameters.map((p) => `${p.name}: ${p.type}`).join(", ")
								: "";
						let returnType = method.returnType;
						if (returnType === "void") {
							returnType = "Promise<void>";
						} else if (returnType.startsWith("Promise<")) {
							returnType = returnType;
						} else {
							returnType = `Promise<${returnType}>`;
						}
						return `    ${method.methodName}(${paramTypes}): ${returnType};`;
					})
					.join("\n");

				return `  ${service.serviceName}: {\n${methods}\n  };`;
			})
			.join("\n");

		const servicesImpl = structure.services
			.map((service) => {
				const methods = service.methods
					.map((method) => {
						const params = method.parameters.map((p) => p.name).join(", ");
						const paramDefs = method.parameters.map((p) => `${p.name}: ${p.type}`).join(", ");
						const argsArray = method.parameters.length > 0 ? `, ${params}` : "";

						return `    ${method.methodName}: (${paramDefs}) =>
      ipcRenderer.invoke('${method.channelName}'${argsArray}),`;
					})
					.join("\n");

				return `  ${service.serviceName}: {\n${methods}\n  },`;
			})
			.join("\n");

		return `import { ipcRenderer } from 'electron';

// 自动生成的IPC服务接口
export interface AutoGeneratedIpcServices {
${servicesInterface}
}

// 自动生成的服务实现
export const autoGeneratedServices: AutoGeneratedIpcServices = {
${servicesImpl}
};

// 导出类型声明扩展
export interface ElectronAPIExtension {
${structure.services.map((service) => `  ${service.serviceName}: AutoGeneratedIpcServices['${service.serviceName}'];`).join("\n")}
}
`;
	}

	public generateMainProcessCode(structure: GeneratedIpcStructure): string {
		// 收集所有需要导入的服务类
		const serviceClasses = structure.services.map((service) => service.className);
		const imports =
			serviceClasses.length > 0
				? `import { ${serviceClasses.join(", ")} } from '../services';`
				: "";

		const registrations = structure.services
			.map((service) => {
				const instanceName = `${service.serviceName}Instance`;
				const methods = service.methods
					.map((method) => {
						// 生成参数列表，排除 event 参数
						const businessParams = method.parameters.filter((p) => p.name !== "event");
						const paramNames = businessParams.map((p) => p.name).join(", ");
						const paramList = businessParams.length > 0 ? `, ${paramNames}` : "";
						const handlerParams = businessParams.length > 0 ? `event, ${paramNames}` : "event";

						return `  ipcMain.handle('${method.channelName}', (${handlerParams}) =>
    ${instanceName}.${method.methodName}(event${paramList})
  );`;
					})
					.join("\n");

				return `  // ${service.serviceName} 服务注册
  const ${instanceName} = new ${service.className}();
${methods}`;
			})
			.join("\n\n");

		return `import { ipcMain } from 'electron';
${imports}

// 自动生成的IPC主进程注册
export function registerIpcHandlers() {
${registrations}
}

// 清理IPC处理器
export function removeIpcHandlers() {
${structure.services
	.map((service) =>
		service.methods.map((method) => `  ipcMain.removeHandler('${method.channelName}');`).join("\n"),
	)
	.join("\n")}
}
`;
	}
}

export function ipcServiceGenerator(options: IpcServiceGeneratorOptions = {}): Plugin {
	const {
		servicesDir = "electron/services",
		outputDir = "generated",
		channelPrefix = "",
	} = options;

	function generateFiles(config: any) {
		const resolvedServicesDir = path.resolve(config.root, servicesDir);
		const resolvedOutputDir = path.resolve(config.root, outputDir);

		console.log(`🔍 IPC服务生成器：扫描目录 ${resolvedServicesDir}`);

		try {
			const parser = new TypeScriptServiceParser(resolvedServicesDir);
			const methods = parser.parseServices();

			console.log(`📊 发现 ${methods.length} 个包含_event参数的方法`);

			if (methods.length === 0) {
				console.log("ℹ️  没有找到包含_event参数的方法，跳过生成");
				return;
			}

			const generator = new IpcStructureGenerator(methods, options);
			const structure = generator.generateStructure();

			if (!fs.existsSync(resolvedOutputDir)) {
				fs.mkdirSync(resolvedOutputDir, { recursive: true });
			}

			// 生成可导入的服务模块
			const servicesModuleCode = generator.generatePreloadServicesModule(structure);
			const servicesModuleFile = path.join(resolvedOutputDir, "preload-services.ts");
			fs.writeFileSync(servicesModuleFile, servicesModuleCode);

			// 生成主进程注册代码
			const mainCode = generator.generateMainProcessCode(structure);
			const mainFile = path.join(resolvedOutputDir, "ipc-registration.ts");
			fs.writeFileSync(mainFile, mainCode);

			console.log(`✅ IPC结构已生成：`);
			console.log(`   📦 服务模块: ${path.relative(config.root, servicesModuleFile)}`);
			console.log(`   ⚙️  主进程注册: ${path.relative(config.root, mainFile)}`);
			console.log(`   📊 服务数量: ${structure.services.length}`);

			structure.services.forEach((service) => {
				console.log(
					`     🏷️  ${service.serviceName} (${service.className}): ${service.methods.length} 个方法`,
				);
				service.methods.forEach((method) => {
					const params = method.parameters.map((p) => `${p.name}: ${p.type}`).join(", ");
					console.log(`        └─ ${method.methodName}(${params}) -> ${method.channelName}`);
				});
			});
		} catch (error) {
			console.error("❌ IPC服务生成器错误：", error);
			if (error instanceof Error) {
				console.error("详细错误：", error.message);
			}
		}
	}

	let config: any;

	return {
		name: "ipc-service-generator",
		configResolved(resolvedConfig) {
			config = resolvedConfig;
			generateFiles(config);
		},
		handleHotUpdate(ctx) {
			// 只处理服务目录下的 TypeScript 文件
			if (ctx.file.includes(servicesDir) && ctx.file.endsWith(".ts")) {
				console.log(`🔄 服务文件更新，重新生成 IPC 结构: ${path.relative(config.root, ctx.file)}`);
				generateFiles(config);
			}
		},
	};
}

export default ipcServiceGenerator;
