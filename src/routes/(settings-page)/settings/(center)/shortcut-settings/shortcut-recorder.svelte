<script lang="ts">
	import { m } from "$lib/paraglide/messages";
	import { formatShortcutKeys, isMac } from "$lib/shortcut/shortcut-config";
	import { cn } from "$lib/utils";

	interface Props {
		value?: string[];
		onValueChange: (keys: string[]) => void;
		placeholder?: string;
		className?: string;
		disabled?: boolean;
		onRecordingChange?: (isRecording: boolean) => void;
		allShortcuts?: { action: string; keys: string[] }[];
		onReset?: () => void;
	}

	let {
		value = $bindable([]),
		onValueChange,
		placeholder,
		className,
		disabled = false,
		onRecordingChange,
		allShortcuts = [],
		onReset,
	}: Props = $props();

	let isRecording = $state(false);
	let currentKeys = $state<string[]>([]);

	const checkShortcutConflict = (
		keys: string[],
		allShortcuts: { action: string; keys: string[] }[] = [],
	): boolean => {
		const normalizedCurrentKeys = !isMac
			? keys.map((key) => (key === "Cmd" ? "Ctrl" : key === "Option" ? "Alt" : key))
			: keys;
		const currentKeysStr = normalizedCurrentKeys.slice().sort().join(",");

		return allShortcuts.some((shortcut) => {
			const normalizedExistingKeys = !isMac
				? shortcut.keys.map((key) => (key === "Cmd" ? "Ctrl" : key === "Option" ? "Alt" : key))
				: shortcut.keys;

			const existingKeysStr = normalizedExistingKeys.slice().sort().join(",");
			return existingKeysStr === currentKeysStr;
		});
	};

	const hasModifierKey = (keys: string[]): boolean => {
		const modifierKeys = ["Ctrl", "Cmd", "Alt", "Shift"];
		return keys.some((key) => modifierKeys.includes(key));
	};

	const isValidShortcut = (keys: string[]): boolean => {
		if (!hasModifierKey(keys)) {
			return false;
		}

		const modifierKeys = ["Ctrl", "Cmd", "Alt", "Shift"];
		const nonModifierKeys = keys.filter((key) => !modifierKeys.includes(key));
		return nonModifierKeys.length > 0;
	};

	const handleKeyDown = (event: KeyboardEvent) => {
		if (!isRecording) return;

		event.preventDefault();
		event.stopPropagation();

		if (event.key === "Backspace") {
			isRecording = false;
			currentKeys = [];
			onRecordingChange?.(false);
			return;
		}

		const newKeys: string[] = [];

		if (event.ctrlKey) newKeys.push("Ctrl");
		if (event.metaKey) newKeys.push("Cmd");
		if (event.altKey) newKeys.push("Alt");
		if (event.shiftKey) newKeys.push("Shift");

		if (event.key && !["Control", "Meta", "Shift", "Alt"].includes(event.key)) {
			let keyToAdd = event.key;
			if (keyToAdd.length === 1) {
				keyToAdd = keyToAdd.toUpperCase();
			} else if (keyToAdd === " ") {
				keyToAdd = "Space";
			} else if (keyToAdd === "Escape") {
				keyToAdd = "Esc";
			}

			newKeys.push(keyToAdd);
		}

		currentKeys = newKeys;
	};

	const handleKeyUp = (event: KeyboardEvent) => {
		if (!isRecording) return;

		event.preventDefault();
		event.stopPropagation();

		if (currentKeys.length === 0) {
			return;
		}

		if (!isValidShortcut(currentKeys)) {
			currentKeys = [];
			isRecording = false;
			onRecordingChange?.(false);
			return;
		}
		if (checkShortcutConflict(currentKeys, allShortcuts)) {
			currentKeys = [];
			isRecording = false;
			onRecordingChange?.(false);
			return;
		}

		isRecording = false;
		onValueChange(currentKeys);
		currentKeys = [];
		onRecordingChange?.(false);
	};

	const startRecording = () => {
		if (disabled) return;
		isRecording = true;
		currentKeys = [];
		onRecordingChange?.(true);
	};

	const handleReset = () => {
		if (onReset) {
			onReset();
		} else {
			onValueChange([]);
		}
	};

	const handleCancel = () => {
		isRecording = false;
		currentKeys = [];
		onRecordingChange?.(false);
	};

	const formatKeys = (keys: string[]) => {
		return formatShortcutKeys(keys);
	};
	const displayValue = $derived(() => {
		if (isRecording) {
			return currentKeys.length > 0 ? formatKeys(currentKeys) : m.settings_shortcut_pressKeys();
		}
		return value.length > 0 ? formatKeys(value) : placeholder || m.settings_shortcut_placeholder();
	});
	$effect(() => {
		if (!isRecording) return;

		document.addEventListener("keydown", handleKeyDown);
		document.addEventListener("keyup", handleKeyUp);

		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("keyup", handleKeyUp);
		};
	});
</script>

<div class={cn("relative", className)}>
	<div
		class={cn(
			"h-settings-item rounded-settings-item bg-settings-item-bg px-settings-item-x py-settings-item-y flex w-full items-center justify-between",
			"focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none",
			value.length === 0 && "text-muted-fg",
			disabled && "cursor-not-allowed opacity-50",
			isRecording && "border-primary ring-ring ring-1",
			!isRecording && !disabled && "cursor-text",
		)}
		onclick={() => {
			if (!isRecording && !disabled) {
				startRecording();
			}
		}}
		role="button"
		tabindex={disabled ? -1 : 0}
		onkeydown={(e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				if (!isRecording && !disabled) {
					startRecording();
				}
			}
		}}
	>
		<span class="text-settings-shortcut-size flex-1 text-left">{displayValue()}</span>

		{#if isRecording}
			<button
				type="button"
				onclick={(e) => {
					e.stopPropagation();
					handleCancel();
				}}
				class="text-settings-shortcut-size text-primary hover:text-primary/80 ml-2 cursor-pointer font-medium"
			>
				{m.settings_shortcut_cancel()}
			</button>
		{:else}
			<button
				type="button"
				onclick={(e) => {
					e.stopPropagation();
					handleReset();
				}}
				class="text-settings-shortcut-size text-primary hover:text-primary/80 ml-2 cursor-pointer font-medium"
			>
				{m.settings_shortcut_reset()}
			</button>
		{/if}
	</div>
</div>
