import type { ServiceMethod, GeneratedIpcStructure, IpcServiceGeneratorOptions } from "./types";
import dedent from "dedent";

/**
 * IPC structure generator
 * Responsible for generating Preload service modules and main process registration code
 */
export class IpcStructureGenerator {
	constructor(
		private methods: ServiceMethod[],
		private options: IpcServiceGeneratorOptions,
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
			// Check parameter types
			method.parameters.forEach((param) => {
				if (!param.isEventParam) {
					const cleanType = this.cleanTypeString(param.type);
					if (!builtInTypes.has(cleanType) && !this.isBuiltInComplexType(cleanType)) {
						customTypes.add(cleanType);
					}
				}
			});

			// Check return type
			const cleanReturnType = this.cleanTypeString(method.returnType);
			if (!builtInTypes.has(cleanReturnType) && !this.isBuiltInComplexType(cleanReturnType)) {
				customTypes.add(cleanReturnType);
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
						return `${method.methodName}(${paramTypes}): ${method.returnType};`;
					})
					.join("\n");

				return `${service.serviceName}: {\n${methods}\n};`;
			})
			.join("\n");

		const servicesImpl = structure.services
			.map((service) => {
				const methods = service.methods
					.map((method) => {
						const params = method.parameters.map((p) => p.name).join(", ");
						const paramDefs = method.parameters.map((p) => `${p.name}: ${p.type}`).join(", ");
						const argsArray = method.parameters.length > 0 ? `, ${params}` : "";

						return `${method.methodName}: (${paramDefs}) => ipcRenderer.invoke('${method.channelName}'${argsArray}),`;
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
		// Collect all service classes that need to be imported
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
						// Generate parameter list, excluding event parameter
						const businessParams = method.parameters.filter((p) => p.name !== "event");
						const paramNames = businessParams.map((p) => p.name).join(", ");
						const paramList = businessParams.length > 0 ? `, ${paramNames}` : "";
						const handlerParams = businessParams.length > 0 ? `event, ${paramNames}` : "event";

						return `\tipcMain.handle('${method.channelName}', (${handlerParams}) =>\n${instanceName}.${method.methodName}(event${paramList})\n);`;
					})
					.join("\n");

				return `// ${service.serviceName} service registration\nconst ${instanceName} = new ${service.className}();\n${methods}`;
			})
			.join("\n\n");

		const removeHandlers = structure.services
			.map((service) =>
				service.methods
					.map((method) => `ipcMain.removeHandler('${method.channelName}');`)
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
