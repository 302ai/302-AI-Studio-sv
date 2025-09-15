<script lang="ts">
	import * as Select from "$lib/components/ui/select/index.js";
	import SettingInfoItem from "$lib/components/buss/settings/setting-info-item.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import { m } from "$lib/paraglide/messages";

	import {
		DEFAULT_SHORTCUTS,
		formatShortcutLabel,
		SHORTCUT_MODES,
		SHORTCUT_OPTIONS,
		type ShortcutAction,
		type ShortcutActionWithoutSendMessage,
		type ShortcutOption,
		type ShortcutScope,
	} from "$lib/shortcut/shortcut-config";
	import ShortcutRecorder from "./shortcut-recorder.svelte";

	interface ShortcutSetting {
		id: string;
		action: ShortcutAction;
		keys: string[];
		scope: ShortcutScope;
		mode: "preset" | "record" | "display";
		options: ShortcutOption[];
		hint?: string;
		isGroup?: boolean;
		groupedShortcuts?: ShortcutSetting[];
	}

	const shortcutSettings = $derived((): ShortcutSetting[] => {
		const shortcutHints: Record<ShortcutActionWithoutSendMessage, string> = {
			newChat: "settings_shortcut_hints_newChat",
			clearMessages: "settings_shortcut_hints_clearMessages",
			closeCurrentTab: "settings_shortcut_hints_closeCurrentTab",
			closeOtherTabs: "settings_shortcut_hints_closeOtherTabs",
			deleteCurrentThread: "settings_shortcut_hints_deleteCurrentThread",
			openSettings: "settings_shortcut_hints_openSettings",
			toggleSidebar: "settings_shortcut_hints_toggleSidebar",
			stopGeneration: "settings_shortcut_hints_stopGeneration",
			newTab: "settings_shortcut_hints_newTab",
			regenerateResponse: "settings_shortcut_hints_regenerateResponse",
			search: "settings_shortcut_hints_search",
			createBranch: "settings_shortcut_hints_createBranch",
			restoreLastTab: "settings_shortcut_hints_restoreLastTab",
			screenshot: "settings_shortcut_hints_screenshot",
			nextTab: "settings_shortcut_hints_nextTab",
			previousTab: "settings_shortcut_hints_previousTab",
			toggleModelPanel: "settings_shortcut_hints_toggleModelPanel",
			toggleIncognitoMode: "settings_shortcut_hints_toggleIncognitoMode",
			branchAndSend: "settings_shortcut_hints_branchAndSend",
			switchToTab1: "settings_shortcut_hints_switchToTab1",
			switchToTab2: "settings_shortcut_hints_switchToTab2",
			switchToTab3: "settings_shortcut_hints_switchToTab3",
			switchToTab4: "settings_shortcut_hints_switchToTab4",
			switchToTab5: "settings_shortcut_hints_switchToTab5",
			switchToTab6: "settings_shortcut_hints_switchToTab6",
			switchToTab7: "settings_shortcut_hints_switchToTab7",
			switchToTab8: "settings_shortcut_hints_switchToTab8",
			switchToTab9: "settings_shortcut_hints_switchToTab9",
		};

		const allSettings = DEFAULT_SHORTCUTS.map((shortcut) => ({
			id: shortcut.id,
			action: shortcut.action,
			keys: Array.from(shortcut.keys),
			scope: shortcut.scope,
			mode: SHORTCUT_MODES[shortcut.action],
			options: SHORTCUT_OPTIONS[shortcut.action],
			hint: shortcutHints[shortcut.action as ShortcutActionWithoutSendMessage],
		}));
		const tabSwitchActions = [
			"switchToTab1",
			"switchToTab2",
			"switchToTab3",
			"switchToTab4",
			"switchToTab5",
			"switchToTab6",
			"switchToTab7",
			"switchToTab8",
			"switchToTab9",
		];

		const tabSwitchSettings = allSettings.filter((setting) =>
			tabSwitchActions.includes(setting.action),
		);

		const otherSettings = allSettings.filter(
			(setting) => !tabSwitchActions.includes(setting.action),
		);
		if (tabSwitchSettings.length > 0) {
			const groupedTabSwitch: ShortcutSetting = {
				id: "tab-switching-group",
				action: "switchToTab1",
				keys: [],
				scope: "app",
				mode: "display",
				options: [],
				hint: "settings_shortcut_hints_tabSwitchingGroup",
				isGroup: true,
				groupedShortcuts: tabSwitchSettings,
			};

			return [...otherSettings, groupedTabSwitch];
		}

		return otherSettings;
	});
</script>

<!-- {#snippet exportButton()}
	<Button size="sm" variant="ghost">
		重置
	</Button>
{/snippet} -->

<div class="flex flex-col gap-4 py-[18px]">
	{#each shortcutSettings() as shortcut (shortcut.id)}
		<div class="flex max-w-[528px] min-w-[528px] flex-col">
			<Label class="text-label-fg mb-2">
				{shortcut.isGroup
					? m.settings_shortcut_tabSwitchingGroup()
					: m[`settings_shortcut_${shortcut.action}`]()}
			</Label>

			{#if shortcut.isGroup}
				<div class="flex items-center gap-2">
					<div
						class="h-settings-item rounded-settings-item bg-settings-item-bg px-settings-item-x py-settings-item-y flex w-full items-center justify-between"
					>
						{#if shortcut.groupedShortcuts?.[0] && shortcut.groupedShortcuts[0].keys.length > 0}
							{@const firstTabShortcut = shortcut.groupedShortcuts[0]}
							{@const modifierKeys = firstTabShortcut.keys.filter(
								(key: string) => !/^[1-9]$/.test(key),
							)}
							{#if modifierKeys.length > 0}
								<span class="text-settings-shortcut-size">
									{formatShortcutLabel(modifierKeys)} + 1~9\
								</span>
							{:else}
								<span class="text-settings-shortcut-size"> 1~9 </span>
							{/if}
						{:else}
							<span class="text-settings-shortcut-size"> 1~9 </span>
						{/if}
					</div>
				</div>
			{:else if shortcut.mode === "preset"}
				<div class="flex items-center gap-2">
					<Select.Root type="single">
						<Select.Trigger
							class="bg-setting text-setting-fg h-11 rounded-[10px] inset-ring-transparent transition-none hover:inset-ring-transparent"
						/>
						<Select.Content>
							{#each shortcut.options as option (option.id)}
								<Select.Item id={option.id} value={option.id}>
									<div class="flex w-full items-center justify-between">
										<!-- <span>{formatShortcutLabel(option.keys)}</span> -->
									</div>
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			{:else if shortcut.mode === "display"}
				<!-- 仅显示模式 -->

				{#if shortcut.keys.length > 0}
					<!-- <Label class="text-label-fg">切换</Label> -->
					<SettingInfoItem label={formatShortcutLabel(shortcut.keys)} />
				{:else}
					{m.settings_shortcut_noShortcut()}
				{/if}
			{:else}
				<ShortcutRecorder
					value={shortcut.keys}
					onValueChange={(_keys) => {}}
					onRecordingChange={(_isRecording) => {}}
					disabled={false}
					allShortcuts={shortcutSettings()?.map((s) => ({
						action: s.action,
						keys: s.keys,
					}))}
					onReset={() => {}}
					className="flex-1"
				/>
			{/if}
			{#if shortcut.hint}
				<p class="text-settings-shortcut-hint mt-1 text-left text-xs">
					{(m as unknown as Record<string, () => string>)[shortcut.hint]()}
				</p>
			{/if}
		</div>
	{/each}
</div>
