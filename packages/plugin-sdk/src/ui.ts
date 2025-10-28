/**
 * UI-related Types
 *
 * Types for dialogs, windows, notifications, and HTTP requests
 */

/**
 * Dialog options
 */
export interface DialogOptions {
	/** Dialog title */
	title: string;

	/** Dialog message */
	message: string;

	/** Dialog type */
	type?: "info" | "warning" | "error" | "question";

	/** Button labels */
	buttons?: string[];

	/** Default button index */
	defaultId?: number;

	/** Cancel button index */
	cancelId?: number;
}

/**
 * Dialog result
 */
export interface DialogResult {
	/** Selected button index */
	response: number;

	/** Whether dialog was cancelled */
	cancelled: boolean;
}

/**
 * Window options
 */
export interface WindowOptions {
	/** Window URL */
	url: string;

	/** Window title */
	title?: string;

	/** Window width */
	width?: number;

	/** Window height */
	height?: number;

	/** Is modal */
	modal?: boolean;

	/** Additional options */
	[key: string]: unknown;
}

/**
 * Request options for HTTP client
 */
export interface RequestOptions {
	/** Request URL */
	url?: string;

	/** HTTP method */
	method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

	/** Request headers */
	headers?: Record<string, string>;

	/** Request body */
	body?: unknown;

	/** Query parameters */
	params?: Record<string, string | number>;

	/** Request timeout */
	timeout?: number;

	/** Response type */
	responseType?: "json" | "text" | "blob" | "arraybuffer";
}

/**
 * Component registry for UI extensions
 */
export interface ComponentRegistry {
	/** Authentication dialog component */
	authDialog?: string;

	/** Settings page component */
	settingsPage?: string;

	/** Model selector component */
	modelSelector?: string;

	/** Custom message renderer component */
	messageRenderer?: string;

	/** Additional custom components */
	[key: string]: string | undefined;
}
