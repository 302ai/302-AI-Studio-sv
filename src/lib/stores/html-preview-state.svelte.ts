export class HtmlPreviewState {
	isVisible = $state(false);

	currentHtml = $state<string | null>(null);

	openPreview(html: string) {
		this.currentHtml = html;
		this.isVisible = true;
	}

	closePreview() {
		this.isVisible = false;
		this.currentHtml = null;
	}

	togglePreview(html?: string) {
		if (this.isVisible) {
			this.closePreview();
		} else if (html) {
			this.openPreview(html);
		}
	}
}

export const htmlPreviewState = new HtmlPreviewState();
