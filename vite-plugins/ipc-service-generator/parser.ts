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

	private getTypeText(
		typeNode: ts.TypeNode | undefined,
		classGenericParams?: GenericParameter[],
	): string {
		if (!typeNode) return "any";
		let typeText = typeNode.getText();

		// Handle class-level generics substitution
		if (classGenericParams && classGenericParams.length > 0) {
			classGenericParams.forEach((genericParam) => {
				// Replace generic parameter with its constraint or default type if available
				const replacement = genericParam.constraint || genericParam.defaultType || "StorageValue";
				// Use word boundaries to ensure we only replace standalone type parameters
				const regex = new RegExp(`\\b${genericParam.name}\\b`, "g");
				typeText = typeText.replace(regex, replacement);
			});
		}

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

	private parseMethodParameters(
		method: ts.MethodDeclaration,
		classGenericParams?: GenericParameter[],
	): Array<{
		name: string;
		type: string;
		isEventParam: boolean;
		isOptional: boolean;
	}> {
		return method.parameters.map((param) => {
			const name = param.name.getText();
			const type = this.getTypeText(param.type, classGenericParams);
			const isEventParam = this.isEventParameter(param);
			const isOptional = !!param.questionToken; // 检测可选参数标识符 ?
			return { name, type, isEventParam, isOptional };
		});
	}

	private parseMethodReturnType(
		method: ts.MethodDeclaration,
		classGenericParams?: GenericParameter[],
	): string {
		if (method.type) {
			return this.getTypeText(method.type, classGenericParams);
		}
		const signature = this.checker.getSignatureFromDeclaration(method);
		if (signature) {
			const returnType = this.checker.getReturnTypeOfSignature(signature);
			let returnTypeString = this.checker.typeToString(returnType);

			// Apply class-level generic substitution to the type string
			if (classGenericParams && classGenericParams.length > 0) {
				classGenericParams.forEach((genericParam) => {
					const replacement = genericParam.constraint || genericParam.defaultType || "StorageValue";
					const regex = new RegExp(`\\b${genericParam.name}\\b`, "g");
					returnTypeString = returnTypeString.replace(regex, replacement);
				});
			}

			return returnTypeString;
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

	private parseClassGenericParameters(classDeclaration: ts.ClassDeclaration): GenericParameter[] {
		if (!classDeclaration.typeParameters) {
			return [];
		}

		return classDeclaration.typeParameters.map((typeParam) => {
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

			// Normalize paths for cross-platform comparison
			const normalizedFileName = sourceFile.fileName.replace(/\\/g, "/");
			const normalizedServicesDir = this.servicesDir.replace(/\\/g, "/");

			if (!normalizedFileName.includes(normalizedServicesDir)) continue;

			const filePath = sourceFile.fileName;

			ts.forEachChild(sourceFile, (node) => {
				if (ts.isClassDeclaration(node) && node.name) {
					const className = node.name.text;
					const serviceName = this.getServiceName(className);

					// Parse class-level generic parameters
					const classGenericParams = this.parseClassGenericParameters(node);

					node.members.forEach((member) => {
						if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
							const methodName = member.name.text;
							const parameters = this.parseMethodParameters(member, classGenericParams);
							const hasEventParam = parameters.some((p) => p.isEventParam);

							if (hasEventParam) {
								const returnType = this.parseMethodReturnType(member, classGenericParams);
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
