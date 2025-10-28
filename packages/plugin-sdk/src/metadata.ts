/**
 * Plugin Metadata Types
 *
 * Types for plugin metadata, installation info, and status
 */

/**
 * Plugin type enum
 */
export type PluginType = "provider" | "extension" | "theme" | "tool";

/**
 * Plugin permission types
 */
export type PluginPermission =
	| "network" // Access to network APIs
	| "filesystem" // Access to file system
	| "storage" // Access to local storage
	| "ui" // Ability to register UI components
	| "hooks" // Ability to register hooks
	| "ipc" // Access to IPC communication
	| "clipboard" // Access to clipboard
	| "notifications"; // Show notifications

/**
 * Plugin status
 */
export type PluginStatus = "installed" | "enabled" | "disabled" | "error" | "updating";

/**
 * Plugin metadata from plugin.json
 */
export interface PluginMetadata {
	/** Unique plugin identifier (e.g., "com.example.myprovider") */
	id: string;

	/** Plugin display name */
	name: string;

	/** Plugin version (semver) */
	version: string;

	/** Plugin type */
	type: PluginType;

	/** Short description */
	description: string;

	/** Plugin author */
	author: string;

	/** Plugin homepage URL */
	homepage?: string;

	/** Plugin repository URL */
	repository?: string;

	/** Plugin icon path (relative to plugin directory) */
	icon?: string;

	/** Required permissions */
	permissions: PluginPermission[];

	/** Compatible application version range */
	compatibleVersion: string;

	/** Main process entry point */
	main?: string;

	/** Renderer process entry point */
	renderer?: string;

	/** Plugin tags for categorization */
	tags?: string[];

	/** Is this a builtin (official) plugin? */
	builtin?: boolean;

	/** Plugin configuration schema (JSON Schema) */
	configSchema?: Record<string, unknown>;

	/** Default configuration values */
	defaultConfig?: Record<string, unknown>;

	/** I18n resources */
	locales?: string[];
}

/**
 * Installed plugin information
 */
export interface InstalledPlugin {
	/** Plugin metadata */
	metadata: PluginMetadata;

	/** Installation path */
	path: string;

	/** Current status */
	status: PluginStatus;

	/** Installation timestamp */
	installedAt: Date;

	/** Last update timestamp */
	updatedAt?: Date;

	/** User configuration */
	config: Record<string, unknown>;

	/** Error message if status is "error" */
	error?: string;
}
