import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { AiApplication } from "@shared/types";

const { onAiApplicationsLoading } = window.electronAPI.aiApplication;

const persistedAiApplicationState = new PersistedState<AiApplication[]>(
	"AiApplicationsStorage:state",
	[],
);

class AiApplicationsState {
	#isLoading = $state(true);

	aiApplications = $derived(persistedAiApplicationState.current);
	isReady = $derived(persistedAiApplicationState.isHydrated && !this.#isLoading);
	collectedAiApplications = $derived(this.aiApplications.filter((app) => app.collected));

	constructor() {
		onAiApplicationsLoading((loading) => {
			this.#isLoading = loading;
		});
	}

	toggleCollected(app: AiApplication) {
		const newAiApplications = this.aiApplications.map((a) => {
			if (a.id === app.id) {
				return {
					...a,
					collected: !a.collected,
				};
			}
			return a;
		});
		persistedAiApplicationState.current = newAiApplications;
	}
}

export const aiApplicationsState = new AiApplicationsState();
