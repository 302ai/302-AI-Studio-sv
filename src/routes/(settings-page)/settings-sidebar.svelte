<script lang="ts">
	import { m } from "$lib/paraglide/messages.js";
	import type { SidebarItem } from "$lib/settings/sidebar.svelte";
	import Sidebar from "$lib/settings/sidebar.svelte";

	const items: SidebarItem[] = [
		{
			name: "general-settings",
			path: "/settings/general-settings",
			labelKey: m.text_button_settings_general(),
		},
		{
			name: "account-settings",
			path: "/settings/account-settings",
			labelKey: m.text_button_settings_account(),
		},
		{
			name: "preferences-settings",
			path: "/settings/preferences-settings",
			labelKey: m.text_button_settings_preferences(),
		},
		{
			name: "theme-settings",
			path: "/settings/theme-settings",
			labelKey: m.text_button_settings_theme(),
		},
		{
			name: "model-settings",
			path: "/settings/model-settings",
			labelKey: m.text_button_settings_models(),
		},
		{
			name: "phrasing-settings",
			path: "/settings/phrasing-settings",
			labelKey: "提示词",
		},
		{
			name: "agent-settings",
			path: "/settings/agent-settings",
			labelKey: m.title_code_agent(),
		},
		{
			name: "mcp-settings",
			path: "/settings/mcp-settings",
			labelKey: m.text_button_settings_mcp(),
		},
		{
			name: "skill-settings",
			path: "/settings/skill-settings",
			labelKey: m.text_button_settings_skills(),
		},
		{
			name: "data-settings",
			path: "/settings/data-settings",
			labelKey: m.text_button_settings_data(),
		},
		{
			name: "shortcut-settings",
			path: "/settings/shortcut-settings",
			labelKey: m.text_button_settings_shortcuts(),
		},
		{
			name: "about",
			path: "/settings/about",
			labelKey: m.text_button_settings_about(),
		},
	];
</script>

<Sidebar {items} className="bg-settings-sidebar-bg" />
