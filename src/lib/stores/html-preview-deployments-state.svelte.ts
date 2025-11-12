import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { chatState } from "$lib/stores/chat-state.svelte";

export interface HtmlPreviewDeploymentRecord {
	url: string;
	deployedAt: string;
}

type HtmlPreviewDeploymentMap = Record<string, HtmlPreviewDeploymentRecord[]>;

const buildStorageKey = (threadId: string) => `html-preview-deployments:${threadId}`;
const MAX_HISTORY_PER_PREVIEW = 10;

class HtmlPreviewDeploymentsState {
	#threadId = chatState.id;
	#persistedState = new PersistedState<HtmlPreviewDeploymentMap>(
		buildStorageKey(this.#threadId),
		{},
	);

	#ensureThreadStore() {
		const nextThreadId = chatState.id;
		if (nextThreadId === this.#threadId) {
			return;
		}

		this.#threadId = nextThreadId;
		this.#persistedState = new PersistedState<HtmlPreviewDeploymentMap>(
			buildStorageKey(this.#threadId),
			{},
		);
	}

	get state(): HtmlPreviewDeploymentMap {
		this.#ensureThreadStore();
		return this.#persistedState.current;
	}

	append(previewId: string, record: HtmlPreviewDeploymentRecord): void {
		this.#ensureThreadStore();
		if (!previewId) return;

		const state = this.#persistedState.current;
		const existing = state[previewId] ?? [];
		const nextRecords = [...existing, record];

		if (nextRecords.length > MAX_HISTORY_PER_PREVIEW) {
			nextRecords.splice(0, nextRecords.length - MAX_HISTORY_PER_PREVIEW);
		}

		this.#persistedState.current = {
			...state,
			[previewId]: nextRecords,
		};
	}

	clear(previewId: string): void {
		this.#ensureThreadStore();
		const state = this.#persistedState.current;
		if (!(previewId in state)) return;

		const { [previewId]: _removed, ...rest } = state;
		this.#persistedState.current = rest;
	}
}

export const htmlPreviewDeploymentsState = new HtmlPreviewDeploymentsState();
