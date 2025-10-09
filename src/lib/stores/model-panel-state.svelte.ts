/**
 * Global state for the model panel to enable toggling from shortcuts
 */
class ModelPanelState {
	#isOpen = $state(false);

	get isOpen() {
		return this.#isOpen;
	}

	set isOpen(value: boolean) {
		this.#isOpen = value;
	}

	toggle() {
		this.#isOpen = !this.#isOpen;
	}

	open() {
		this.#isOpen = true;
	}

	close() {
		this.#isOpen = false;
	}
}

export const modelPanelState = new ModelPanelState();
