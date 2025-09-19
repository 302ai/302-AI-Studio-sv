import { WebContentsView } from "electron";

export class TabService {
	private tabMap: Map<number, WebContentsView>;

	constructor() {
		this.tabMap = new Map();
	}
}
