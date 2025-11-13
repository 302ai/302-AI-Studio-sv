/**
 * Panel resize utility
 * Provides a reusable function for handling panel resize with drag handle
 */

export interface PanelResizeOptions {
	/** Minimum panel width in pixels (default: 227) */
	minWidth?: number;
	/** Maximum panel width in pixels (default: 1200) */
	maxWidth?: number;
	/** Maximum panel width as percentage of container (default: 0.8 = 80%) */
	maxWidthPercent?: number;
}

/**
 * Setup panel resize functionality
 * Creates an overlay and handles mouse events for smooth resizing
 *
 * @param e - MouseEvent from the drag handle
 * @param options - Configuration options for resize behavior
 *
 * @example
 * ```svelte
 * <div onmousedown={handlePanelResize}>
 *   <GripVerticalIcon />
 * </div>
 *
 * <script>
 *   import { setupPanelResize } from '$lib/utils/panel-resize';
 *
 *   const handlePanelResize = (e: MouseEvent) => {
 *     setupPanelResize(e, { minWidth: 300, maxWidth: 1500 });
 *   };
 * </script>
 * ```
 */
export function setupPanelResize(e: MouseEvent, options: PanelResizeOptions = {}) {
	const { minWidth = 227, maxWidth = 1200, maxWidthPercent = 0.8 } = options;

	e.preventDefault();
	e.stopPropagation();

	const startX = e.clientX;
	const panelDiv = (e.currentTarget as HTMLElement).parentElement;
	if (!panelDiv) return;

	const startWidth = panelDiv.getBoundingClientRect().width;
	const containerWidth = panelDiv.parentElement?.getBoundingClientRect().width || window.innerWidth;

	// Create fullscreen transparent overlay to capture mouse events
	const overlay = document.createElement("div");
	Object.assign(overlay.style, {
		position: "fixed",
		inset: "0",
		zIndex: "50",
		cursor: "col-resize",
		userSelect: "none",
	});
	overlay.setAttribute("data-resize-overlay", "true");
	document.body.appendChild(overlay);

	const cleanup = () => {
		document.removeEventListener("mousemove", handleMouseMove, true);
		document.removeEventListener("mouseup", handleMouseUp, true);
		window.removeEventListener("blur", handleBlur);
		overlay.parentNode?.removeChild(overlay);
		document.body.style.cursor = "";
		document.body.style.userSelect = "";
	};

	const handleMouseMove = (moveEvent: MouseEvent) => {
		moveEvent.preventDefault();
		moveEvent.stopPropagation();

		const diff = startX - moveEvent.clientX;
		const computedMaxWidth = Math.min(containerWidth * maxWidthPercent, maxWidth);
		const newWidth = Math.max(minWidth, Math.min(startWidth + diff, computedMaxWidth));

		panelDiv.style.width = `${newWidth}px`;
	};

	const handleMouseUp = () => cleanup();
	const handleBlur = () => cleanup();

	document.body.style.cursor = "col-resize";
	document.body.style.userSelect = "none";

	document.addEventListener("mousemove", handleMouseMove, true);
	document.addEventListener("mouseup", handleMouseUp, true);
	window.addEventListener("blur", handleBlur);
}
