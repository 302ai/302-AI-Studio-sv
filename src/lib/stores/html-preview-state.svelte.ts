export type HtmlPreviewMode = "preview" | "edit";

export interface HtmlPreviewContext {
	messageId: string;
	messagePartIndex: number;
	blockId: string;
	meta: string | null;
}

export interface HtmlPreviewPayload extends HtmlPreviewContext {
	code: string;
	language: string | null;
}

export class HtmlPreviewState {
	isVisible = $state(false);
	isPinned = $state(false);
	mode = $state<HtmlPreviewMode>("preview");
	context = $state<HtmlPreviewContext | null>(null);
	initialHtml = $state<string | null>(null);
	editedHtml = $state("");
	initialLanguage = $state<string | null>(null);
	selectedLanguage = $state<string | null>(null);

	openPreview(payload: HtmlPreviewPayload) {
		this.context = {
			messageId: payload.messageId,
			messagePartIndex: payload.messagePartIndex,
			blockId: payload.blockId,
			meta: payload.meta,
		};
		this.initialHtml = payload.code;
		this.editedHtml = payload.code;
		this.initialLanguage = payload.language;
		this.selectedLanguage = payload.language;
		this.mode = "preview";
		this.isVisible = true;
	}

	closePreview() {
		this.isVisible = false;
		this.isPinned = false;
		this.mode = "preview";
		this.context = null;
		this.initialHtml = null;
		this.editedHtml = "";
		this.initialLanguage = null;
		this.selectedLanguage = null;
	}

	togglePreview(payload?: HtmlPreviewPayload) {
		// If no payload provided, just toggle visibility
		if (!payload) {
			if (this.isVisible) {
				this.closePreview();
			}
			return;
		}

		// If preview is visible with a different context, switch to new preview
		if (this.isVisible && this.context) {
			const isDifferent =
				this.context.messageId !== payload.messageId ||
				this.context.messagePartIndex !== payload.messagePartIndex ||
				this.context.blockId !== payload.blockId;

			if (isDifferent) {
				// Switch to new preview
				this.openPreview(payload);
			} else {
				// Same content, toggle off
				this.closePreview();
			}
		} else {
			// Preview not visible or no context, open it
			this.openPreview(payload);
		}
	}

	setMode(mode: HtmlPreviewMode) {
		this.mode = mode;
	}

	setEditedHtml(value: string) {
		this.editedHtml = value;
	}

	setSelectedLanguage(language: string | null) {
		this.selectedLanguage = language;
	}

	resetToInitial() {
		this.editedHtml = this.initialHtml ?? "";
		this.selectedLanguage = this.initialLanguage;
	}

	commitChanges() {
		this.initialHtml = this.editedHtml;
		this.initialLanguage = this.selectedLanguage;
	}

	togglePin() {
		this.isPinned = !this.isPinned;
	}
}

export const htmlPreviewState = new HtmlPreviewState();
