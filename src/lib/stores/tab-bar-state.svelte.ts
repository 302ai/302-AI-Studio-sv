import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { Tab } from "@shared/types";

function getInitTabs(): Tab[] {
	return [
		{
			id: "1",
			title: "New Chat",
			href: "/chat/1",
			type: "chat",
		},
		{
			id: "2",
			title: "New Chat",
			href: "/chat/2",
			type: "chat",
		},
		{
			id: "3",
			title: "Settings",
			href: "/settings/general-settings",
			type: "settings",
		},
	];
}

export const persistedTabs = new PersistedState<Tab[]>("app-tab-state", getInitTabs());

// class TabBarState {}
