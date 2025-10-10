import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { AiApplication } from "@shared/types";

const persistedAiApplicationState = new PersistedState<AiApplication[]>(
	"AiApplicationsStorage:state",
	[],
);

class AiApplicationsState {
	aiApplications = $derived(persistedAiApplicationState.current);

	constructor() {}
}

export const aiApplicationsState = new AiApplicationsState();
