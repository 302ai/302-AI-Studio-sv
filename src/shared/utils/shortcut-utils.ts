import type { InputEventLike } from "@shared/types/shortcut";

// Platform detection: works in both main (Node.js) and renderer (browser) processes
const isMac =
	typeof process !== "undefined"
		? process.platform === "darwin"
		: typeof window !== "undefined" && window.app?.platform === "darwin";

/**
 * Normalize modifier keys and regular key into a canonical format
 * Returns sorted array like ["Cmd", "Shift", "W"] or ["Ctrl", "Tab"]
 */
export function normalizeKeys(input: InputEventLike): string[] {
	const keys: string[] = [];

	// Add modifiers in canonical order
	if (input.control) keys.push("Ctrl");
	if (input.meta) keys.push(isMac ? "Cmd" : "Meta");
	if (input.alt) keys.push("Alt");
	if (input.shift) keys.push("Shift");

	// Add regular key (normalized)
	if (input.key && !["Control", "Meta", "Alt", "Shift"].includes(input.key)) {
		let keyName = input.key;

		// Normalize special keys
		if (keyName === " ") keyName = "Space";
		else if (keyName === "Escape") keyName = "Esc";
		else if (keyName.length === 1) keyName = keyName.toUpperCase();

		// Handle specific code cases
		if (input.code.startsWith("Digit")) {
			keyName = input.code.replace("Digit", "");
		} else if (input.code === "Comma") {
			keyName = ",";
		} else if (input.code === "Period") {
			keyName = ".";
		} else if (input.code === "Slash") {
			keyName = "/";
		} else if (input.code === "Backslash") {
			keyName = "\\";
		} else if (input.code === "Minus") {
			keyName = "-";
		} else if (input.code === "Equal") {
			keyName = "=";
		} else if (input.code === "BracketLeft") {
			keyName = "[";
		} else if (input.code === "BracketRight") {
			keyName = "]";
		}

		keys.push(keyName);
	}

	return keys;
}

/**
 * Convert keys array to canonical string format
 * e.g., ["Cmd", "Shift", "W"] -> "Cmd+Shift+W"
 */
export function keysToString(keys: string[]): string {
	return keys.join("+");
}

/**
 * Parse string format to keys array
 * e.g., "Cmd+Shift+W" -> ["Cmd", "Shift", "W"]
 */
export function stringToKeys(str: string): string[] {
	return str.split("+").map((k) => k.trim());
}

/**
 * Convert keys to Electron accelerator format
 * e.g., ["Cmd", "Shift", "W"] -> "CommandOrControl+Shift+W"
 */
export function keysToAccelerator(keys: string[]): string {
	return keys
		.map((key) => {
			if (key === "Cmd") return "CommandOrControl";
			if (key === "Meta") return "CommandOrControl";
			if (key === "Esc") return "Escape";
			return key;
		})
		.join("+");
}

/**
 * Check if two keys arrays are equal
 */
export function keysEqual(keys1: string[], keys2: string[]): boolean {
	if (keys1.length !== keys2.length) return false;
	const sorted1 = [...keys1].sort();
	const sorted2 = [...keys2].sort();
	return sorted1.every((k, i) => k === sorted2[i]);
}

/**
 * Platform-specific key display mapping
 */
export const PLATFORM_KEY_MAP: Record<string, string> = {
	Cmd: isMac ? "⌘" : "Ctrl",
	Meta: isMac ? "⌘" : "Win",
	Alt: isMac ? "⌥" : "Alt",
	Option: isMac ? "⌥" : "Alt",
	Shift: isMac ? "⇧" : "Shift",
	Ctrl: isMac ? "⌃" : "Ctrl",
	Enter: "Enter",
	Backspace: isMac ? "⌫" : "Backspace",
	Delete: isMac ? "⌦" : "Delete",
	Tab: isMac ? "⇥" : "Tab",
	Esc: isMac ? "⎋" : "Esc",
	Space: "Space",
	ArrowUp: "↑",
	ArrowDown: "↓",
	ArrowLeft: "←",
	ArrowRight: "→",
};

/**
 * Format keys for display
 */
export function formatKeys(keys: string[]): string {
	return keys.map((key) => PLATFORM_KEY_MAP[key] || key).join("+");
}
