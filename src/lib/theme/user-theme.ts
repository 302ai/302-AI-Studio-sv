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
 * Applies raw CSS input directly to the application.
 * Users can write any valid CSS rules that will be applied globally.
 * Example accepted input:
 *   button { background: red; color: white; }
 *   .my-class { font-size: 16px; }
 *   :root { --ui-accent: #8e47f0; }
 */
export function applyRawUserCss(raw: string): void {
	if (typeof document === "undefined") return;
	const el = ensureStyleEl();
	el.textContent = raw || "";
}
