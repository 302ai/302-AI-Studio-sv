import type { Tab } from "$lib/components/buss/tab-bar";

class TabState {
	tabs = $state<Tab[]>([]);
	activeTabId = $state("home");

	constructor() {
		this.tabs = [];
		this.activeTabId = "home";
	}
}

export const tabState = new TabState();
