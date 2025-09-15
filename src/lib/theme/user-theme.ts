const STYLE_ID = "user-theme-overrides";

function ensureStyleEl(): HTMLStyleElement {
	let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
	if (!el) {
		el = document.createElement("style");
		el.id = STYLE_ID;
		document.head.appendChild(el);
	}
	return el;
}

/**
 * Applies user overrides for --ui-* variables from a simple map.
 * Only --ui-* variables are written to keep overrides safe and scoped.
 */
export function applyUserVars(vars: Record<string, string>): void {
	if (typeof document === "undefined") return;
	const entries = Object.entries(vars)
		.filter(([k]) => k.trim().startsWith("--ui-"))
		.map(([k, v]) => `${k.trim()}: ${String(v).trim()};`)
		.join("\n  ");

	const css = entries ? `:root {\n  ${entries}\n}` : "";
	const el = ensureStyleEl();
	el.textContent = css;
}

/**
 * Applies raw CSS-like input but only keeps lines setting --ui-* variables.
 * Example accepted input from Settings UI:
 *   --ui-accent: oklch(65% 0.16 280);
 *   --ui-accent-fg: #fff;
 */
export function applyRawUserCss(raw: string): void {
	if (typeof document === "undefined") return;
	const lines = (raw ?? "")
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean)

		.filter((l) => l.startsWith("--ui-"))

		.map((l) => l.replace(/[{}]/g, ""))

		.map((l) => (l.endsWith(";") ? l : l + ";"));

	const css = lines.length ? `:root {\n  ${lines.join("\n  ")}\n}` : "";
	const el = ensureStyleEl();
	el.textContent = css;
}
