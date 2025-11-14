<script lang="ts">
	import CodeMirrorEditor from "$lib/components/buss/editor/codemirror-editor.svelte";
	import type { EditorView } from "@codemirror/view";

	interface Props {
		value: string;
		language: string | null;
		onValueChange: (value: string) => void;
		readOnly?: boolean;
		onMount?: (view: EditorView) => void;
	}

	let { value, language, onValueChange, readOnly = false, onMount }: Props = $props();

	let codeMirrorView: EditorView | null = $state(null);

	const handleMount = (view: EditorView) => {
		codeMirrorView = view;
		onMount?.(view);
	};

	export const focus = () => {
		codeMirrorView?.focus();
	};
</script>

<div class="h-full flex flex-col" style="min-height: 0;">
	<!-- Top toolbar -->
	<!-- <div class="border-b border-border px-4 py-3 flex items-center justify-between gap-4 shrink-0">
		<div class="flex items-center gap-2 text-sm text-muted-foreground">
			<span class="font-medium">{languageLabel}</span>
		</div>

		<div class="flex items-center gap-1">
			<Button
				size="sm"
				variant="ghost"
				onclick={onReset}
				disabled={!isDirty}
				class="h-8 w-8 p-0"
				title={m.text_button_reset()}
			>
				<RotateCcw class="h-4 w-4" />
			</Button>
			<Button
				size="sm"
				variant="ghost"
				onclick={onSave}
				disabled={!isDirty || isSaving}
				class="h-8 w-8 p-0"
				title={isSaving ? m.text_button_saving() : m.text_button_save()}
			>
				<Save class="h-4 w-4" />
			</Button>
		</div>
	</div> -->

	<!-- Editor area -->
	<div class="flex-1 overflow-hidden" style="min-height: 0;">
		<CodeMirrorEditor
			{value}
			language={language || "html"}
			theme="dark"
			fontSize={14}
			{readOnly}
			onChange={onValueChange}
			onMount={handleMount}
		/>
	</div>
</div>
