import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { Model } from "@302ai/studio-plugin-sdk";
import type { SessionMetadata } from "@shared/storage/session";

export const persistedSessionState = new PersistedState<SessionMetadata>(
	"SessionStorage:session-metadata",
	{
		latestUsedModel: null,
	},
);

class SessionState {
	get latestUsedModel(): Model | null {
		return persistedSessionState.current.latestUsedModel;
	}

	set latestUsedModel(value: Model | null) {
		persistedSessionState.current.latestUsedModel = value;
	}
}

export const sessionState = new SessionState();
