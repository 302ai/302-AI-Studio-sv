import type {
	ServiceMethod,
	GeneratedIpcStructure,
	IpcServiceGeneratorOptions,
	GenericParameter,
} from "./types";
import dedent from "dedent";
import * as path from "path";

/**
 * IPC structure generator
 * Responsible for generating Preload service modules and main process registration code
 */
export class IpcStructureGenerator {
	constructor(
		private methods: ServiceMethod[],
		private options: IpcServiceGeneratorOptions,
		private paths: {
			servicesDir: string;
			outputDir: string;
		},
	) {}

	/**
	 * Extract custom types used in service methods
	 * Checks parameter types and return types for non-built-in types
	 */
	private extractCustomTypes(): Set<string> {
		const customTypes = new Set<string>();
		const builtInTypes = new Set([
			"string",
			"number",
			"boolean",
			"void",
			"any",
			"unknown",
			"undefined",
			"null",
			"object",
			"Array",
			"Promise",
			"IpcMainInvokeEvent",
			"Electron.IpcMainInvokeEvent",
		]);

		this.methods.forEach((method) => {
			const hasGenericParams = method.genericParameters.length > 0;
			const genericParamNames = hasGenericParams
				? new Set(method.genericParameters.map((gp) => gp.name))
				: new Set();

			// Check parameter types
			method.parameters.forEach((param) => {
				if (!param.isEventParam) {
					// Extract all types from the parameter type string
					const typesInParam = this.extractTypesFromString(param.type);
					typesInParam.forEach((type) => {
						if (!builtInTypes.has(type) && !this.isBuiltInComplexType(type)) {
							// Only exclude generic parameter names if this method actually has generics
							if (!hasGenericParams || !genericParamNames.has(type)) {
								customTypes.add(type);
							}
						}
					});
				}
			});

			// Check return type
			const typesInReturn = this.extractTypesFromString(method.returnType);
			typesInReturn.forEach((type) => {
				if (!builtInTypes.has(type) && !this.isBuiltInComplexType(type)) {
					// Only exclude generic parameter names if this method actually has generics
					if (!hasGenericParams || !genericParamNames.has(type)) {
						customTypes.add(type);
					}
				}
			});

			// Check generic parameter default types (only for methods that actually have generics)
			if (hasGenericParams) {
				method.genericParameters.forEach((genericParam) => {
					if (genericParam.defaultType) {
						const typesInDefault = this.extractTypesFromString(genericParam.defaultType);
						typesInDefault.forEach((type) => {
							if (!builtInTypes.has(type) && !this.isBuiltInComplexType(type)) {
								customTypes.add(type);
							}
						});
					}

					// Check constraint types
					if (genericParam.constraint) {
						const typesInConstraint = this.extractTypesFromString(genericParam.constraint);
						typesInConstraint.forEach((type) => {
							if (!builtInTypes.has(type) && !this.isBuiltInComplexType(type)) {
								customTypes.add(type);
							}
						});
					}
				});
			}
		});

		return customTypes;
	}

	/**
	 * Clean type string by removing Promise wrapper and array indicators
	 */
	private cleanTypeString(type: string): string {
		// Remove Promise<T> wrapper
		const promiseMatch = type.match(/^Promise<(.+)>$/);
		if (promiseMatch) {
			type = promiseMatch[1];
		}

		// Remove array indicators
		type = type.replace(/\[\]$/, "").replace(/^Array<(.+)>$/, "$1");

		// Remove union type syntax and extract base type
		if (type.includes("|")) {
			const types = type.split("|").map((t) => t.trim());
			// For union types, we'll take the first non-primitive type
			for (const unionType of types) {
				if (!["string", "number", "boolean", "null", "undefined"].includes(unionType)) {
					return unionType;
				}
			}
			return types[0];
		}

		return type.trim();
	}

	/**
	 * Extract all types from a type string, including generic types
	 */
	private extractTypesFromString(typeString: string): Set<string> {
		const types = new Set<string>();

		// Match generic types like StorageItem<T>, Promise<StorageValue>, etc.
		const genericTypeRegex = /(\w+)<([^<>]+(?:<[^<>]*>)*)>/g;
		let match;

		while ((match = genericTypeRegex.exec(typeString)) !== null) {
			const baseType = match[1];
			const genericArgs = match[2];

			// Add the base type (e.g., StorageItem from StorageItem<T>)
			types.add(baseType);

			// Recursively extract types from generic arguments
			if (genericArgs) {
				const innerTypes = this.extractTypesFromString(genericArgs);
				innerTypes.forEach((t) => types.add(t));
			}
		}

		// If no generic types found, check if it's a simple type
		if (types.size === 0) {
			const cleanType = this.cleanTypeString(typeString);
			if (cleanType && cleanType !== typeString) {
				// Type was cleaned, extract from the cleaned version
				const innerTypes = this.extractTypesFromString(cleanType);
				innerTypes.forEach((t) => types.add(t));
			} else {
				// Simple type, add as is
				types.add(cleanType);
			}
		}

		return types;
	}

	/**
	 * Check if a type is a generic parameter name (single uppercase letter typically)
	 */
	private isGenericParameterName(type: string): boolean {
		// Generic parameters are typically single uppercase letters like T, U, K, V
		return /^[A-Z]$/.test(type.trim()) || /^[A-Z][A-Za-z]*$/.test(type.trim());
	}

	/**
	 * Check if type is a built-in complex type (like generics)
	 */
	private isBuiltInComplexType(type: string): boolean {
		return (
			type.startsWith("Array<") ||
			type.startsWith("Promise<") ||
			type.startsWith("Record<") ||
			type.startsWith("Map<") ||
			type.startsWith("Set<") ||
			type.endsWith("[]") ||
			type.includes("(") // function types
		);
	}

	private generateChannelName(serviceName: string, methodName: string): string {
		const prefix = this.options.channelPrefix || "";
		return `${prefix}${serviceName}:${methodName}`;
	}

	/**
	 * Generate generic parameter string for TypeScript
	 */
	private generateGenericParametersString(genericParams: GenericParameter[]): string {
		if (genericParams.length === 0) return "";

		const params = genericParams.map((param) => {
			let result = param.name;

			if (param.constraint) {
				result += ` extends ${param.constraint}`;
			}

			if (param.defaultType) {
				result += ` = ${param.defaultType}`;
			}

			return result;
		});

		return `<${params.join(", ")}>`;
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
					genericParameters: GenericParameter[];
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
				genericParameters: method.genericParameters,
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
						const genericString = this.generateGenericParametersString(method.genericParameters);
						const paramTypes =
							method.parameters.length > 0
								? method.parameters.map((p) => `${p.name}: ${p.type}`).join(", ")
								: "";
						return `${method.methodName}${genericString}(${paramTypes}): ${method.returnType};`;
					})
					.join("\n");

				return `${service.serviceName}: {\n${methods}\n};`;
			})
			.join("\n");

		const servicesImpl = structure.services
			.map((service) => {
				const methods = service.methods
					.map((method) => {
						const genericString = this.generateGenericParametersString(method.genericParameters);
						const params = method.parameters.map((p) => p.name).join(", ");
						const paramDefs = method.parameters.map((p) => `${p.name}: ${p.type}`).join(", ");
						const argsArray = method.parameters.length > 0 ? `, ${params}` : "";

						// For generic methods, we need to add type assertion
						const returnTypeAssertion =
							method.genericParameters.length > 0 ? ` as ${method.returnType}` : "";

						return `${method.methodName}: ${genericString}(${paramDefs}) => ipcRenderer.invoke('${method.channelName}'${argsArray})${returnTypeAssertion},`;
					})
					.join("\n");

				return `${service.serviceName}: {\n${methods}\n},`;
			})
			.join("\n");

		const extensionInterface = structure.services
			.map(
				(service) => `${service.serviceName}: AutoGeneratedIpcServices['${service.serviceName}'];`,
			)
			.join("\n");

		// Generate imports for custom types
		const customTypes = this.extractCustomTypes();
		const typeImports =
			customTypes.size > 0
				? `import type { ${Array.from(customTypes).join(", ")} } from '@shared/types';`
				: "";

		return dedent`
			import { ipcRenderer } from 'electron';
			${typeImports}

			/**
      * Auto-generated IPC service interfaces
      */
			export interface AutoGeneratedIpcServices {
			${servicesInterface}
			}

			/**
      * Auto-generated service implementations
      */
			export const autoGeneratedServices: AutoGeneratedIpcServices = {
			${servicesImpl}
			};

			/**
      * Export type declaration extensions
      */
			export interface ElectronAPIExtension {
			${extensionInterface}
			}
		`;
	}

	public generateMainProcessCode(structure: GeneratedIpcStructure): string {
		// Collect all service instances that need to be imported
		const serviceInstances = structure.services.map((service) => service.serviceName);

		// Calculate relative path from output directory to services directory
		const relativePath = path.relative(this.paths.outputDir, this.paths.servicesDir);
		const importPath = relativePath.replace(/\\/g, "/"); // Ensure forward slashes for cross-platform compatibility

		const imports =
			serviceInstances.length > 0
				? `import { ${serviceInstances.join(", ")} } from '${importPath}';`
				: "";

		const registrations = structure.services
			.map((service) => {
				const instanceName = service.serviceName;
				const methods = service.methods
					.map((method) => {
						// Generate parameter list, excluding event parameter
						const businessParams = method.parameters.filter((p) => p.name !== "event");
						const paramNames = businessParams.map((p) => p.name).join(", ");
						const paramList = businessParams.length > 0 ? `, ${paramNames}` : "";
						const handlerParams = businessParams.length > 0 ? `event, ${paramNames}` : "event";

						return `\tipcMain.handle('${method.channelName}', (${handlerParams}) =>\n\t\t${instanceName}.${method.methodName}(event${paramList})\n\t);`;
					})
					.join("\n");

				return `\t// ${service.serviceName} service registration\n${methods}`;
			})
			.join("\n\n");

		const removeHandlers = structure.services
			.map((service) =>
				service.methods
					.map((method) => `\tipcMain.removeHandler('${method.channelName}');`)
					.join("\n"),
			)
			.join("\n");

		return dedent`
			import { ipcMain } from 'electron';
			${imports}

			/**
      * Auto-generated IPC service interfaces
      */
			export function registerIpcHandlers() {
			${registrations}
			}

			/**
      * Clean up IPC handlers
      */
			export function removeIpcHandlers() {
			${removeHandlers}
			}
		`;
	}
}
