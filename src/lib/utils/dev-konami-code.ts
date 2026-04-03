import { createLogger } from "@shared/logger";

const logger = createLogger("ui");

/**
 * Derive a printable character from `KeyboardEvent.code`.
 * This is IME-independent — works even when a Chinese/Japanese input method is active,
 * because `e.code` represents the physical key, not the composed character.
 *
 * Maps: "KeyA"→"a", "Digit3"→"3", etc.
 * Returns null for non-printable keys (Shift, Control, F1, etc.)
 */
function charFromCode(code: string): string | null {
	if (code.startsWith("Key")) {
		return code.slice(3).toLowerCase(); // "KeyA" → "a"
	}
	if (code.startsWith("Digit")) {
		return code.slice(5); // "Digit3" → "3"
	}
	return null;
}

/**
 * Creates a keyboard sequence detector that triggers a callback when
 * a specific character sequence is typed (e.g., "302aidev" Konami code).
 *
 * - Uses `e.code` (physical key) so it works regardless of IME state
 * - Ignores keypresses with active modifiers (Ctrl/Meta/Alt)
 * - Uses a sliding window to match the sequence
 * - Resets buffer after a configurable timeout
 *
 * @param sequence The character sequence to match (lowercase letters + digits only)
 * @param onMatch Callback when the sequence is matched
 * @param timeout Buffer reset timeout in ms (default: 2000)
 * @returns Cleanup function to remove the event listener
 */
export function createDevSequenceDetector(
	sequence: string,
	onMatch: () => void,
	timeout = 2000,
): () => void {
	let buffer = "";
	let timer: ReturnType<typeof setTimeout> | null = null;

	function handleKeydown(e: KeyboardEvent) {
		logger.debug("[DevKonami] keydown →", {
			key: e.key,
			code: e.code,
			ctrlKey: e.ctrlKey,
			metaKey: e.metaKey,
			altKey: e.altKey,
			isComposing: e.isComposing,
		});

		// Ignore keypresses with active modifiers (Ctrl+C, Cmd+V, etc.)
		if (e.ctrlKey || e.metaKey || e.altKey) {
			logger.debug("[DevKonami] skipped (modifier active)");
			return;
		}

		// Derive character from physical key code (IME-safe)
		const ch = charFromCode(e.code);
		if (!ch) {
			logger.debug("[DevKonami] skipped (non-printable code:", e.code, ")");
			return;
		}

		// Reset timeout
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			logger.debug("[DevKonami] buffer reset (timeout)");
			buffer = "";
		}, timeout);

		buffer += ch;

		// Keep buffer size bounded to the sequence length (sliding window)
		if (buffer.length > sequence.length) {
			buffer = buffer.slice(-sequence.length);
		}

		logger.debug(
			"[DevKonami] buffer:",
			JSON.stringify(buffer),
			"| target:",
			JSON.stringify(sequence),
			"| match:",
			buffer === sequence,
		);

		// Check for match
		if (buffer === sequence) {
			buffer = "";
			if (timer) clearTimeout(timer);
			logger.debug("[DevKonami] ✅ MATCH! Triggering callback");
			onMatch();
		}
	}

	window.addEventListener("keydown", handleKeydown, true);

	return () => {
		window.removeEventListener("keydown", handleKeydown, true);
		if (timer) clearTimeout(timer);
	};
}
