import * as ts from "typescript";
import * as path from "path";
import { glob } from "glob";
import type { ServiceMethod, GenericParameter } from "./types";

/**
 * TypeScript service parser
 * Responsible for parsing TypeScript files in the services directory and extracting service methods containing IPC event parameters
 */
export class TypeScriptServiceParser {
	private program!: ts.Program;
	private checker!: ts.TypeChecker;

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
		return className.charAt(0).toLowerCase() + className.slice(1);
	}

	private getTypeText(typeNode: ts.TypeNode | undefined): string {
		if (!typeNode) return "any";
		const typeText = typeNode.getText();
		const typeMap: Record<string, string> = {
			"Electron.IpcMainInvokeEvent": "IpcMainInvokeEvent",
			IpcMainInvokeEvent: "IpcMainInvokeEvent",
		};
		return typeMap[typeText] ?? typeText;
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

	private parseGenericParameters(method: ts.MethodDeclaration): GenericParameter[] {
		if (!method.typeParameters) {
			return [];
		}

		return method.typeParameters.map((typeParam) => {
			const param: GenericParameter = {
				name: typeParam.name.text,
			};

			// 解析约束 (extends)
			if (typeParam.constraint) {
				param.constraint = this.getTypeText(typeParam.constraint);
			}

			// 解析默认类型
			if (typeParam.default) {
				param.defaultType = this.getTypeText(typeParam.default);
			}

			return param;
		});
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
								const genericParameters = this.parseGenericParameters(member);
								methods.push({
									serviceName,
									className,
									methodName,
									parameters,
									returnType,
									genericParameters,
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
