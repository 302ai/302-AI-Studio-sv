import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { AiApplication } from "@shared/types";

const persistedAiApplicationState = new PersistedState<AiApplication[]>(
	"AiApplicationsStorage:state",
	[],
);

class AiApplicationsState {
	aiApplications = $derived(persistedAiApplicationState.current);
	isHydrated = $derived(persistedAiApplicationState.isHydrated);
	collectedAiApplications = $derived(this.aiApplications.filter((app) => app.collected));

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
