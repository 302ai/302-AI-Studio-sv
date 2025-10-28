/**
 * Plugin Sandbox
 *
 * Provides a sandboxed execution environment for plugins
 * to limit their access to system resources and APIs
 */

import * as vm from "vm";
import * as path from "path";
import type { PluginPermission } from "@302ai/studio-plugin-sdk";

/**
 * Sandbox context for plugin execution
 */
export interface SandboxContext {
	/** Plugin ID */
	pluginId: string;

	/** Granted permissions */
	permissions: PluginPermission[];

	/** Plugin root directory */
	pluginDir: string;

	/** Allowed APIs */
	allowedApis: Set<string>;
}

/**
 * Create a sandboxed execution context for a plugin
 */
export function createPluginSandbox(context: SandboxContext): vm.Context {
	// Base sandbox context with limited globals
	const sandboxContext: Record<string, unknown> = {
		// Console (always allowed)
		console: {
			log: (...args: unknown[]) => console.log(`[Plugin:${context.pluginId}]`, ...args),
			info: (...args: unknown[]) => console.info(`[Plugin:${context.pluginId}]`, ...args),
			warn: (...args: unknown[]) => console.warn(`[Plugin:${context.pluginId}]`, ...args),
			error: (...args: unknown[]) => console.error(`[Plugin:${context.pluginId}]`, ...args),
			debug: (...args: unknown[]) => console.debug(`[Plugin:${context.pluginId}]`, ...args),
		},

		// Timers (always allowed but tracked)
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
		setImmediate,
		clearImmediate,

		// Promise (required for async operations)
		Promise,

		// Common globals
		Object,
		Array,
		String,
		Number,
		Boolean,
		Date,
		Math,
		JSON,
		RegExp,
		Map,
		Set,
		WeakMap,
		WeakSet,
		Error,
		TypeError,
		RangeError,
		SyntaxError,

		// Buffer (restricted to plugin's data)
		Buffer,

		// Process info (limited)
		process: {
			env: {}, // No environment variables by default
			platform: process.platform,
			arch: process.arch,
			version: process.version,
		},

		// Plugin info
		__pluginId: context.pluginId,
		__pluginDir: context.pluginDir,
	};

	// Add APIs based on permissions
	addPermissionBasedAPIs(sandboxContext, context);

	// Create and return the context
	return vm.createContext(sandboxContext);
}

/**
 * Add APIs to sandbox based on granted permissions
 */
function addPermissionBasedAPIs(
	sandboxContext: Record<string, unknown>,
	context: SandboxContext,
): void {
	const { permissions, pluginDir } = context;

	// Network permission
	if (permissions.includes("network")) {
		// Allow fetch API
		sandboxContext.fetch = fetch;
		sandboxContext.Headers = Headers;
		sandboxContext.Request = Request;
		sandboxContext.Response = Response;
	}

	// Filesystem permission (restricted to plugin directory)
	if (permissions.includes("filesystem")) {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const fs = require("fs");

		// Create restricted fs module
		sandboxContext.fs = createRestrictedFS(fs, pluginDir);
		sandboxContext.path = {
			join: path.join,
			resolve: path.resolve,
			dirname: path.dirname,
			basename: path.basename,
			extname: path.extname,
			relative: path.relative,
		};
	}

	// Note: Other permission-based APIs (storage, ipc, etc.) are provided
	// through the PluginAPI interface, not directly in the sandbox
}

/**
 * Create a restricted filesystem API that only allows access
 * to files within the plugin directory
 */
function createRestrictedFS(fs: typeof import("fs"), allowedDir: string): Record<string, unknown> {
	/**
	 * Validate that a path is within the allowed directory
	 */
	function validatePath(filePath: string): string {
		const resolved = path.resolve(filePath);
		const normalized = path.normalize(resolved);

		if (!normalized.startsWith(allowedDir)) {
			throw new Error(`Access denied: Path ${filePath} is outside plugin directory ${allowedDir}`);
		}

		return normalized;
	}

	// Return restricted fs methods with proper type casting
	return {
		readFile: (filePath: string, ...args: unknown[]) => {
			const validPath = validatePath(filePath);
			return (fs.readFile as (...args: unknown[]) => unknown)(validPath, ...args);
		},

		readFileSync: (filePath: string, ...args: unknown[]) => {
			const validPath = validatePath(filePath);
			return (fs.readFileSync as (...args: unknown[]) => unknown)(validPath, ...args);
		},

		writeFile: (filePath: string, ...args: unknown[]) => {
			const validPath = validatePath(filePath);
			return (fs.writeFile as (...args: unknown[]) => unknown)(validPath, ...args);
		},

		writeFileSync: (filePath: string, ...args: unknown[]) => {
			const validPath = validatePath(filePath);
			return (fs.writeFileSync as (...args: unknown[]) => unknown)(validPath, ...args);
		},

		existsSync: (filePath: string) => {
			const validPath = validatePath(filePath);
			return fs.existsSync(validPath);
		},

		statSync: (filePath: string) => {
			const validPath = validatePath(filePath);
			return fs.statSync(validPath);
		},

		readdirSync: (filePath: string) => {
			const validPath = validatePath(filePath);
			return fs.readdirSync(validPath);
		},

		mkdirSync: (filePath: string, ...args: unknown[]) => {
			const validPath = validatePath(filePath);
			return (fs.mkdirSync as (...args: unknown[]) => unknown)(validPath, ...args);
		},

		// Explicitly deny dangerous operations
		unlinkSync: () => {
			throw new Error("File deletion is not allowed in plugin sandbox");
		},

		rmdirSync: () => {
			throw new Error("Directory deletion is not allowed in plugin sandbox");
		},

		renameSync: () => {
			throw new Error("File renaming is not allowed in plugin sandbox");
		},
	};
}

/**
 * Execute code in a plugin sandbox
 */
export function executeInSandbox(
	code: string,
	context: SandboxContext,
	timeout: number = 5000,
): unknown {
	const sandboxContext = createPluginSandbox(context);

	try {
		// Compile and run code in sandbox
		const script = new vm.Script(code, {
			filename: `plugin-${context.pluginId}.js`,
		});

		return script.runInContext(sandboxContext, {
			timeout,
			displayErrors: true,
		});
	} catch (error) {
		console.error(`[Sandbox] Error executing code for plugin ${context.pluginId}:`, error);
		throw error;
	}
}

/**
 * Validate plugin permissions
 * Checks if requested permissions are valid and reasonable
 */
export function validatePermissions(permissions: PluginPermission[]): {
	valid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	// List of valid permissions
	const validPermissions: PluginPermission[] = [
		"network",
		"filesystem",
		"storage",
		"ui",
		"hooks",
		"ipc",
		"clipboard",
		"notifications",
	];

	// Check for invalid permissions
	for (const permission of permissions) {
		if (!validPermissions.includes(permission)) {
			errors.push(`Invalid permission: ${permission}`);
		}
	}

	// Check for dangerous permission combinations
	if (permissions.includes("filesystem") && permissions.includes("network")) {
		// This is potentially dangerous but not necessarily invalid
		console.warn(
			"[Sandbox] Plugin requests both filesystem and network permissions. " +
				"This combination should be reviewed carefully.",
		);
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Permission checker - to be used by plugin API
 */
export function hasPermission(
	grantedPermissions: PluginPermission[],
	requiredPermission: PluginPermission,
): boolean {
	return grantedPermissions.includes(requiredPermission);
}

/**
 * Ensure plugin has required permission, throw if not
 */
export function requirePermission(
	grantedPermissions: PluginPermission[],
	requiredPermission: PluginPermission,
	action: string,
): void {
	if (!hasPermission(grantedPermissions, requiredPermission)) {
		throw new Error(
			`Permission denied: ${requiredPermission} permission is required for ${action}`,
		);
	}
}
