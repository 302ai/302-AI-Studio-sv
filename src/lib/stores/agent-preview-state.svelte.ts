export type HtmlPreviewMode = "preview" | "edit";

export class AgentPreviewState {
	isVisible = $state(false);
	isPinned = $state(false);
	mode = $state<HtmlPreviewMode>("preview");
	sandBoxId = $state();
	// context = $state<HtmlPreviewContext | null>(null);

	openPreview(sandBoxId: string) {
		console.log("[AgentPreviewState] openPreview called", {
			sandBoxId,
			previousVisible: this.isVisible,
		});
		// this.context = {
		// 	messageId: payload.messageId,
		// 	messagePartIndex: payload.messagePartIndex,
		// 	blockId: payload.blockId,
		// 	meta: payload.meta,
		// };
		this.sandBoxId = sandBoxId;
		this.mode = "preview";
		this.isVisible = true;
		console.log("[AgentPreviewState] After setting, isVisible:", this.isVisible);
	}

	closePreview() {
		this.isVisible = false;
		this.isPinned = false;
		this.mode = "preview";
	}

	togglePreview() {}

	setMode(mode: HtmlPreviewMode) {
		this.mode = mode;
	}

	togglePin() {
		this.isPinned = !this.isPinned;
	}
}

export const agentPreviewState = new AgentPreviewState();
