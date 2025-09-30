/**
 * Type definitions for IPC service generator
 */

export interface GenericParameter {
	name: string;
	constraint?: string; // extends constraint
	defaultType?: string; // default type
}

export interface ServiceMethod {
	serviceName: string;
	className: string;
	methodName: string;
	parameters: Array<{
		name: string;
		type: string;
		isEventParam: boolean;
		isOptional: boolean; // 是否为可选参数
	}>;
	returnType: string;
	genericParameters: GenericParameter[]; // 泛型参数
	filePath: string;
}

export interface GeneratedIpcStructure {
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
				isOptional: boolean; // 是否为可选参数
			}>;
			returnType: string;
			genericParameters: GenericParameter[]; // 泛型参数
		}>;
	}>;
}

export interface IpcServiceGeneratorOptions {
	servicesDir?: string;
	outputDir?: string;
	channelPrefix?: string;
	methodFilter?: (methodName: string) => boolean;
	formatCommand?: string | false; // 格式化命令，false 表示禁用格式化
}
