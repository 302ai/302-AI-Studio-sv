<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Textarea } from "$lib/components/ui/textarea/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { getThemeCss, resetThemeCss, setThemeCss } from "$lib/stores/theme-css.state.svelte";

	let raw = $state(getThemeCss());

	function apply() {
		setThemeCss(raw);
	}

	function reset() {
		resetThemeCss();
		raw = "";
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-4">
		<div>
			<Label class="text-sm font-medium">{m.text_theme_custom_css_title()}</Label>
			<p class="text-muted-foreground mt-1 text-xs">
				{m.text_theme_custom_css_description()}
			</p>
		</div>

		<Textarea
			bind:value={raw}
			placeholder={m.text_theme_custom_css_placeholder()}
			class="min-h-40 font-mono text-sm"
		/>

		<div class="flex gap-2">
			<Button onclick={apply}>{m?.apply?.() ?? "Apply"}</Button>
			<Button variant="secondary" onclick={reset}>{m?.reset?.() ?? "Reset"}</Button>
		</div>

		<div class="bg-muted/50 text-muted-foreground rounded-lg p-4 text-sm">
			<p class="mb-2 font-medium">{m.text_theme_custom_css_usage_notes()}</p>
			<ul class="list-disc space-y-1 pl-5">
				<li>{m.text_theme_custom_css_note_1()}</li>
				<li>{m.text_theme_custom_css_note_2()}</li>
				<li>{m.text_theme_custom_css_note_3()}</li>
				<li class="text-amber-600 dark:text-amber-400">
					<strong>Tip:</strong>
					{m.text_theme_custom_css_tip()}
				</li>
			</ul>
		</div>
	</div>
</div>
