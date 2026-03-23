/**
 * Constants for agent-preview module
 */

export const DEFAULT_WORKSPACE_PATH = "/home/user/workspace";

export const TAB_PREVIEW = "preview";
export const TAB_CODE = "code";
export const TAB_TERMINAL = "terminal";
export const TAB_SKILLS = "skills";
export const TAB_TASKBOARD = "taskboard";
export const TAB_OPENCLAW_WEBUI = "openclaw-webui";

export type TabType =
	| typeof TAB_PREVIEW
	| typeof TAB_CODE
	| typeof TAB_TERMINAL
	| typeof TAB_SKILLS
	| typeof TAB_TASKBOARD
	| typeof TAB_OPENCLAW_WEBUI;

export const DEVICE_MODE_DESKTOP = "desktop";
export const DEVICE_MODE_MOBILE = "mobile";

export type DeviceMode = typeof DEVICE_MODE_DESKTOP | typeof DEVICE_MODE_MOBILE;
