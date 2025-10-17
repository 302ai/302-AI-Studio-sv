const SCREENSHOT_CONFIG = {
	WIDTH: 800,
	PADDING: 20,
	COLORS: {
		DARK_BG: "#09090b",
		LIGHT_BG: "#ffffff",
		DARK_TEXT: "#6b7280",
		LIGHT_TEXT: "#9ca3af",
	},
} as const;

// Logo
const LOGO_302_SVG = `
  <svg width="20" height="20" viewBox="0 0 513.24 512.3" xmlns="http://www.w3.org/2000/svg">
    <style>
      .cls-1 { fill: #fff; }
      .cls-2 { fill: #8e47f0; }
      .cls-3 { fill: #3f3faa; }
    </style>
    <g>
      <circle class="cls-3" cx="281.41" cy="280.46" r="231.83"/>
      <circle class="cls-2" cx="231.83" cy="231.83" r="231.83"/>
    </g>
    <path class="cls-1" d="M228.26,386.12c-16.47,0-32.38-5.44-45.57-15.73-15.66-12.21-25.64-29.8-28.07-49.51-.74-6.02-.77-11.99-.09-17.86-4.58,.89-9.32,1.35-14.15,1.35-41,0-74.36-33.36-74.36-74.36s33.36-74.36,74.36-74.36c5.86,0,11.57,.68,17.04,1.97-.32-2.8-.48-5.64-.48-8.49,0-41,33.36-74.36,74.36-74.36s74.36,33.36,74.36,74.36c0,2.38-.11,4.75-.34,7.11,6.02-1.05,12.2-1.37,18.43-.9,40.89,3.03,71.69,38.77,68.66,79.66-1.47,19.81-10.57,37.86-25.61,50.83-15.05,12.97-34.26,19.31-54.05,17.83-3.6-.27-7.14-.79-10.6-1.55,.02,.17,.04,.34,.07,.51,2.44,19.71-2.94,39.19-15.15,54.86-12.21,15.67-29.8,25.64-49.51,28.08-3.11,.38-6.21,.57-9.29,.57Zm-41.27-98.21c-5.22,9.04-7.29,19.29-6,29.71,1.57,12.67,7.97,23.97,18.04,31.81,10.06,7.85,22.58,11.31,35.25,9.74,12.67-1.57,23.97-7.97,31.81-18.04,7.85-10.07,11.31-22.59,9.74-35.25-1.03-8.36-4.21-16.21-9.23-22.86-3.28-3.17-6.28-6.65-8.97-10.44-4.25-5.98-2.85-14.28,3.13-18.53,5.98-4.26,14.28-2.85,18.53,3.12,.99,1.39,2.04,2.72,3.16,3.98,.89,.63,1.72,1.38,2.47,2.24,.45,.53,.9,1.06,1.33,1.6,7.8,7.05,17.76,11.36,28.46,12.15,26.34,1.97,49.24-17.84,51.19-44.12,1.95-26.28-17.84-49.24-44.12-51.19-10.07-.75-19.9,1.63-28.47,6.88-4.07,3.34-9.92,4.07-14.82,1.38-6.43-3.53-8.79-11.61-5.26-18.04,3.83-6.98,5.85-14.91,5.85-22.93,0-26.35-21.44-47.79-47.79-47.79s-47.79,21.44-47.79,47.79c0,9.43,2.74,18.54,7.92,26.36,.25,.38,.48,.77,.69,1.17,13.94,13.52,22.61,32.45,22.61,53.36,0,23.37-10.83,44.25-27.74,57.89Zm-46.62-105.68c-26.35,0-47.79,21.44-47.79,47.79s21.44,47.79,47.79,47.79,47.79-21.44,47.79-47.79-21.44-47.79-47.79-47.79Z"/>
  </svg>
`;

/**
 * code block 滚动条样式
 */
export function injectScrollbarStyles(isDarkMode: boolean): HTMLStyleElement {
	const style = document.createElement("style");
	const borderColor = isDarkMode ? "#3d3d3d" : "#d9d9d9";

	style.textContent = `
    .screenshot-wrapper *::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    .screenshot-wrapper *::-webkit-scrollbar-thumb {
      background: ${borderColor};
      border-radius: 10px;
    }
    
    .screenshot-wrapper *::-webkit-scrollbar-track {
      background: transparent;
    }
  `;
	return style;
}

/**
 * 创建截图的外层包装容器
 */
export function createScreenshotWrapper(): HTMLDivElement {
	const wrapper = document.createElement("div");
	wrapper.className = "screenshot-wrapper";
	wrapper.style.cssText = `
    padding: ${SCREENSHOT_CONFIG.PADDING}px;
    width: ${SCREENSHOT_CONFIG.WIDTH}px;
    position: fixed;
    left: -9999px;
    z-index: -1;
  `;
	return wrapper;
}

/**
 * 创建内容容器
 */
export function createContentContainer(): HTMLDivElement {
	const container = document.createElement("div");
	container.style.cssText = `
    width: 100%;
    margin: 0 auto;
  `;
	return container;
}

/**
 * 消息内容
 */
export function prepareMessageContent(messageListContainer: Element): HTMLElement {
	const contentWrapper = document.createElement("div");

	const clonedContent = messageListContainer.cloneNode(true) as HTMLElement;

	contentWrapper.appendChild(clonedContent);
	contentWrapper.style.cssText = `
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
  `;

	return contentWrapper;
}

/**
 * 创建水印
 */
export function create302Watermark(isDarkMode: boolean): HTMLDivElement {
	const watermark = document.createElement("div");
	watermark.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 0;
    margin-top: 20px;
    font-size: 14px;
    font-weight: 500;
    color: ${isDarkMode ? SCREENSHOT_CONFIG.COLORS.DARK_TEXT : SCREENSHOT_CONFIG.COLORS.LIGHT_TEXT};
    font-family: system-ui, -apple-system, sans-serif;
    letter-spacing: 0.5px;
    line-height: 1;
  `;

	watermark.innerHTML = `
    <div style="width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;">
      ${LOGO_302_SVG}
    </div>
    <span style="display:inline-flex;align-items:center;line-height:20px;vertical-align:middle;">302.AI</span>
  `;

	return watermark;
}

/**
 * 截图配置
 */
export function getScreenshotOptions(isDarkMode: boolean) {
	return {
		backgroundColor: isDarkMode
			? SCREENSHOT_CONFIG.COLORS.DARK_BG
			: SCREENSHOT_CONFIG.COLORS.LIGHT_BG,
		// scale: 1.2,
		embedFonts: true,
		compress: false,
		quality: 0.9,
		skipAutoScale: false,
		logging: false,
	};
}
