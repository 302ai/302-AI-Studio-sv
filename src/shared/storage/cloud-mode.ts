import { type } from "arktype";

export const cloudSandboxHealthResponseSchema = type({
	success: "boolean",
	status: "string",
	oc_status: "string",
}).pipe((data) => ({
	success: data.success,
	status: data.status,
	ocStatus: data.oc_status,
}));
export type CloudSandboxHealthResponse = typeof cloudSandboxHealthResponseSchema.infer;

export const instanceInfoSchema = type({
	instance_name: "string",
	public_ip: "string",
	created_at: "string",
	expired_at: "string",
	api_port: "number",
	oc_port: "number",
	openclaw_gateway_token: "string",
}).pipe((data) => ({
	instanceName: data.instance_name,
	publicIp: data.public_ip,
	createdAt: data.created_at,
	expiredAt: data.expired_at,
	apiPort: data.api_port,
	ocPort: data.oc_port,
	openclawGatewayToken: data.openclaw_gateway_token,
}));
export type InstanceInfo = typeof instanceInfoSchema.infer;
export const listInstancesResponseSchema = type({
	success: "boolean",
	instances: instanceInfoSchema.array(),
});
export type ListInstancesResponse = typeof listInstancesResponseSchema.infer;

export const createInstanceRequestSchema = type({
	isDev: "boolean",
	isAutoRenew: "boolean",
}).pipe((data) => ({
	is_dev: data.isDev,
	is_auto_renew: data.isAutoRenew,
}));
export type CreateInstanceRequest = typeof createInstanceRequestSchema.inferIn;

export const createInstanceResponseSchema = type({
	success: "boolean",
	instance: instanceInfoSchema,
});
export type CreateInstanceResponse = typeof createInstanceResponseSchema.infer;

export const instanceStatusResponseSchema = type({
	success: "boolean",
	instance: {
		instance_name: "string",
		instance_status: "string",
	},
}).pipe((data) => ({
	success: data.success,
	instance: {
		instanceName: data.instance.instance_name,
		instanceStatus: data.instance.instance_status,
	},
}));
export type InstanceStatusResponse = typeof instanceStatusResponseSchema.infer;

export const restartDockerRequestSchema = type({
	instanceName: "string",
	openclawConfigContent: "string.json?",
}).pipe((data) => ({
	instance_name: data.instanceName,
	openclaw_config_content: data.openclawConfigContent,
}));
export type RestartDockerRequest = typeof restartDockerRequestSchema.inferIn;

export const restartDockerResponseSchema = type({
	success: "boolean",
	instance_name: "string",
}).pipe((data) => ({
	success: data.success,
	instanceName: data.instance_name,
}));
export type RestartDockerResponse = typeof restartDockerResponseSchema.infer;

export const rebootInstanceRequestSchema = type({
	instanceName: "string",
}).pipe((data) => ({
	instance_name: data.instanceName,
}));
export type RebootInstanceRequest = typeof rebootInstanceRequestSchema.inferIn;

export const rebootInstanceResponseSchema = type({
	success: "boolean",
	message: "string",
});
export type RebootInstanceResponse = typeof rebootInstanceResponseSchema.infer;

export const readFilesRequestSchema = type({
	instanceName: "string",
	filePaths: "string[]",
}).pipe((data) => ({
	instance_name: data.instanceName,
	file_paths: data.filePaths,
}));
export type ReadFilesRequest = typeof readFilesRequestSchema.inferIn;
export const fileReadResultSchema = type({
	success: "boolean",
	file_path: "string",
	file_content: "string",
}).pipe((data) => ({
	success: data.success,
	filePath: data.file_path,
	fileContent: data.file_content,
}));
export const readFilesResponseSchema = type({
	success: "boolean",
	files: fileReadResultSchema.array(),
});
export type ReadFilesResponse = typeof readFilesResponseSchema.infer;

export const fileWriteItemSchema = type({
	filePath: "string",
	fileContent: "string",
}).pipe((data) => ({
	file_path: data.filePath,
	file_content: data.fileContent,
}));
export const writeFilesRequestSchema = type({
	instanceName: "string",
	files: fileWriteItemSchema.array(),
}).pipe((data) => ({
	instance_name: data.instanceName,
	files: data.files,
}));
export type WriteFilesRequest = typeof writeFilesRequestSchema.inferIn;
export const fileWriteResultSchema = type({
	success: "boolean",
	file_path: "string",
}).pipe((data) => ({
	success: data.success,
	filePath: data.file_path,
}));
export const writeFilesResponseSchema = type({
	success: "boolean",
	files: fileWriteResultSchema.array(),
});
export type WriteFilesResponse = typeof writeFilesResponseSchema.infer;

export const execCommandRequestSchema = type({
	instanceName: "string",
	cmd: "string",
	cwd: "string",
}).pipe((data) => ({
	instance_name: data.instanceName,
	cmd: data.cmd,
	cwd: data.cwd,
}));
export type ExecCommandRequest = typeof execCommandRequestSchema.inferIn;

export const execCommandResponseSchema = type({
	success: "boolean",
	exit_code: "number",
	stdout: "string",
	stderr: "string",
}).pipe((data) => ({
	success: data.success,
	exitCode: data.exit_code,
	stdout: data.stdout,
	stderr: data.stderr,
}));
export type ExecCommandResponse = typeof execCommandResponseSchema.infer;
