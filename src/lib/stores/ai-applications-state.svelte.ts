import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { AiApplication } from "@shared/types";

const persistedAiApplicationState = new PersistedState<AiApplication[]>(
	"AiApplicationsStorage:state",
	[],
);

class AiApplicationsState {
	aiApplications = $derived(persistedAiApplicationState.current);
	isHydrated = $derived(persistedAiApplicationState.isHydrated);
}

export const aiApplicationsState = new AiApplicationsState();
