import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { AiApplication } from "@shared/types";

const { onAiApplicationsLoading } = window.electronAPI.aiApplication;

const persistedAiApplicationState = new PersistedState<AiApplication[]>(
	"AiApplicationsStorage:state",
	[],
);

class AiApplicationsState {
	#isLoading = $state(false);

	aiApplications = $derived(persistedAiApplicationState.current);
	isReady = $derived(persistedAiApplicationState.isHydrated && !this.#isLoading);
	collectedAiApplications = $derived.by(() => {
		const collected = this.aiApplications.filter((app) => app.collected);
		return collected.sort((a, b) => {
			// Sort by collectedAt in descending order (newest first)
			const aTime = a.collectedAt ? new Date(a.collectedAt).getTime() : 0;
			const bTime = b.collectedAt ? new Date(b.collectedAt).getTime() : 0;
			return bTime - aTime;
		});
	});

	constructor() {
		onAiApplicationsLoading((loading) => {
			this.#isLoading = loading;
		});
	}

	toggleCollected(app: AiApplication) {
		const newAiApplications = this.aiApplications.map((a) => {
			if (a.id === app.id) {
				const newCollectedState = !a.collected;
				return {
					...a,
					collected: newCollectedState,
					collectedAt: newCollectedState ? new Date().toISOString() : undefined,
				};
			}
			return a;
		});
		persistedAiApplicationState.current = newAiApplications;
	}
}

export const aiApplicationsState = new AiApplicationsState();
