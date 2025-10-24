/**
 * State management for sidebar search functionality
 */
class SidebarSearchState {
	private focusTriggerCallbacks: Array<() => void> = [];

	/**
	 * Register a callback to be called when search should be focused
	 */
	registerFocusCallback(callback: () => void): () => void {
		this.focusTriggerCallbacks.push(callback);

		// Return cleanup function
		return () => {
			const index = this.focusTriggerCallbacks.indexOf(callback);
			if (index > -1) {
				this.focusTriggerCallbacks.splice(index, 1);
			}
		};
	}

	/**
	 * Trigger focus on the search input
	 */
	triggerFocus(): void {
		this.focusTriggerCallbacks.forEach((callback) => callback());
	}
}

export const sidebarSearchState = new SidebarSearchState();
