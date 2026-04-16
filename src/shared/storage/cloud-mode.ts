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
	status: '"waiting_init" | "rebooting" | "rebooted" | "running" | "pending" | "starting" | "stopping" | "stopped" | "resetting" | "upgrading" | "disabled"',
	expired: "boolean",
	public_ip: "string",
	created_at: "string",
	expired_at: "string",
	api_port: "number",
	oc_port: "number",
	auto_renew: "boolean",
	destroyed_at: "string?",
}).pipe((data) => ({
	instanceName: data.instance_name,
	status: data.status,
	publicIp: data.public_ip,
	createdAt: data.created_at,
	expiredAt: data.expired_at,
	expired: data.expired,
	apiPort: data.api_port,
	ocPort: data.oc_port,
	autoRenew: data.auto_renew,
	destroyedAt: data.destroyed_at ?? undefined,
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
	instance: type({
		instance_name: "string",
		status: "string",
	}),
}).pipe((data) => ({
	success: data.success,
	instance: {
		instanceName: data.instance.instance_name,
		status: data.instance.status,
	},
}));
export type CreateInstanceResponse = typeof createInstanceResponseSchema.infer;

export const initInstanceRequestSchema = type({
	instanceName: "string",
	isDev: "boolean",
}).pipe((data) => ({
	instance_name: data.instanceName,
	is_dev: data.isDev,
}));
export type InitInstanceRequest = typeof initInstanceRequestSchema.inferIn;
export const initInstanceResponseSchema = type({
	success: "boolean",
	instance: type({
		instance_name: "string",
		public_ip: "string",
		expired_at: "string",
		api_port: "number",
		oc_port: "number",
		status: '"waiting_init" | "rebooting" | "rebooted" | "running"',
	}),
}).pipe((data) => ({
	success: data.success,
	instance: {
		instanceName: data.instance.instance_name,
		publicIp: data.instance.public_ip,
		v: data.instance.expired_at,
		apiPort: data.instance.api_port,
		ocPort: data.instance.oc_port,
		status: data.instance.status,
	},
}));
export type InitInstanceResponse = typeof initInstanceResponseSchema.infer;

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

export const updateAutoRenewRequestSchema = type({
	instanceName: "string",
	isAutoRenew: "boolean",
}).pipe((data) => ({
	instance_name: data.instanceName,
	is_auto_renew: data.isAutoRenew,
}));
export type UpdateAutoRenewRequest = typeof updateAutoRenewRequestSchema.inferIn;
export const updateAutoRenewResponseSchema = type({
	success: "boolean",
	instance: type({
		instance_name: "string",
		auto_renew: "boolean",
	}),
}).pipe((data) => ({
	success: data.success,
	instance: {
		instanceName: data.instance.instance_name,
		autoRenew: data.instance.auto_renew,
	},
}));
export type UpdateAutoRenewResponse = typeof updateAutoRenewResponseSchema.infer;

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

export const updateInstanceAutoRenewRequestSchema = type({
	instanceName: "string",
	isAutoRenew: "boolean",
}).pipe((data) => ({
	instance_name: data.instanceName,
	is_auto_renew: data.isAutoRenew,
}));
export type UpdateInstanceAutoRenewRequest = typeof updateInstanceAutoRenewRequestSchema.inferIn;
export const updateInstanceAutoRenewResponseSchema = type({
	success: "boolean",
	instance: {
		instance_name: "string",
		auto_renew: "boolean",
	},
}).pipe((data) => ({
	success: data.success,
	instance: {
		instanceName: data.instance.instance_name,
		autoRenew: data.instance.auto_renew,
	},
}));
export type UpdateInstanceAutoRenewResponse = typeof updateInstanceAutoRenewResponseSchema.infer;

export const manualRenewRequestSchema = type({
	instanceName: "string",
	isDev: "boolean",
}).pipe((data) => ({
	instance_name: data.instanceName,
	is_dev: data.isDev,
}));
export type ManualRenewRequest = typeof manualRenewRequestSchema.inferIn;
export const manualRenewResponseSchema = type({
	success: "boolean",
	instance: {
		instance_name: "string",
	},
}).pipe((data) => ({
	success: data.success,
	instance: {
		instanceName: data.instance.instance_name,
	},
}));
export type ManualRenewResponse = typeof manualRenewResponseSchema.infer;

export const manualRenewChargeItemSchema = type({
	amount_cent: "number",
	charged_at: "string",
	instance_name: "string",
}).pipe((data) => ({
	amountCent: data.amount_cent,
	chargedAt: data.charged_at,
	instanceName: data.instance_name,
}));

export const manualRenewChargePaginationSchema = type({
	page: "number",
	page_size: "number",
	total: "number",
	total_pages: "number",
}).pipe((data) => ({
	page: data.page,
	pageSize: data.page_size,
	total: data.total,
	totalPages: data.total_pages,
}));

export const getManualRenewChargeResponseSchema = type({
	success: "boolean",
	pagination: manualRenewChargePaginationSchema,
	charges: manualRenewChargeItemSchema.array(),
}).pipe((data) => ({
	success: data.success,
	pagination: data.pagination,
	charges: data.charges,
}));
export type GetManualRenewChargeResponse = typeof getManualRenewChargeResponseSchema.infer;

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

export const sandboxHealthResponseSchema = type({
	"success?": "boolean",
	"status?": "string",
	"oc_status?": "string",
});
export type SandboxHealthResponseSchema = typeof sandboxHealthResponseSchema.infer;

export const sandboxHealthResponse = type({
	"success?": "boolean",
	"status?": "string",
	"oc_status?": "string",
});

export type SandboxHealthResponse = typeof sandboxHealthResponse.infer;

/** A single streaming event from execCommandStream */
export const execStreamEvent = type({
	"event?": "string",
	run_id: "string",
	text: "string",
});

export type ExecStreamEvent = typeof execStreamEvent.infer;

/** Request body for execCommandStream, mirrors the server's CommandRequest model */
export const execStreamRequest = type({
	command: "string",
	cwd: "string?",
	env: "Record<string, string>?",
	timeout: "number?",
});
export type ExecStreamRequest = typeof execStreamRequest.infer;
