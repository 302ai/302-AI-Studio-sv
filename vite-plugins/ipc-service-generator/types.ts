/**
 * Type definitions for IPC service generator
 */

export interface ServiceMethod {
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
			}>;
			returnType: string;
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
