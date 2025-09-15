<script lang="ts">
	import { onMount } from "svelte";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Textarea } from "$lib/components/ui/textarea/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { ThemeEditor } from "$lib/components/buss/theme-editor/index.js";
	import ThemeModeSwitch from "$lib/components/buss/settings/theme-mode-switch.svelte";
	import { applyRawUserCss } from "$lib/theme/user-theme";
	import { m } from "$lib/paraglide/messages.js";

	let raw = $state("");
	let isCodeMode = $state(false);
	const LS_KEY = "user-ui-vars-raw";

	function apply() {
		applyRawUserCss(raw);
		try {
			localStorage.setItem(LS_KEY, raw);
		} catch {
			// Ignore localStorage errors
		}
	}

	function reset() {
		raw = "";
		applyRawUserCss("");
		try {
			localStorage.removeItem(LS_KEY);
		} catch {
			// Ignore localStorage errors
		}
	}

	onMount(() => {
		try {
			const saved = localStorage.getItem(LS_KEY);
			if (saved) {
				raw = saved;
				applyRawUserCss(raw);
			}
		} catch {
			// Ignore localStorage errors
		}
	});
</script>

<div class="space-y-6">
	<!-- Theme mode selector -->
	<ThemeModeSwitch bind:checked={isCodeMode} />

	<!-- Visual Theme Editor -->
	{#if !isCodeMode}
		<ThemeEditor />
	{/if}

	<!-- Code Editor (Legacy) -->
	{#if isCodeMode}
		<div class="flex flex-col gap-4">
			<div>
				<Label class="text-sm font-medium">{m.text_label_theme_code_title()}</Label>
				<p class="mt-1 text-xs text-muted-foreground">
					{m.text_theme_code_description()}
				</p>
			</div>

			<Textarea
				bind:value={raw}
				placeholder="--ui-accent: #8e47f0;\n--ui-accent-fg: #fff;\n--ui-radius: 0.5rem;\n--ui-density: 1;\n--ui-tab-height: 2rem; /* optional per-component */"
				class="min-h-40 font-mono text-sm"
			/>

			<div class="flex gap-2">
				<Button onclick={apply}>{m?.apply?.() ?? "Apply"}</Button>
				<Button variant="secondary" onclick={reset}>{m?.reset?.() ?? "Reset"}</Button>
			</div>

			<div class="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
				<p class="mb-2 font-medium">{m.text_theme_code_usage_notes()}</p>
				<ul class="list-disc space-y-1 pl-5">
					<li>{m.text_theme_code_note_1()}</li>
					<li>{m.text_theme_code_note_2()}</li>
					<li>{m.text_theme_code_note_3()}</li>
					<li class="text-amber-600 dark:text-amber-400">
						<strong>Tip:</strong>
						{m.text_theme_code_tip()}
					</li>
				</ul>
			</div>
		</div>
	{/if}
</div>
