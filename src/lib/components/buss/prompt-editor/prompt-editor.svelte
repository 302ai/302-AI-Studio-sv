<script lang="ts">
	import { cn } from "$lib/utils";
	import { $getRoot as getRoot, TextNode, type LexicalEditor } from "lexical";
	import { onMount } from "svelte";
	import { Composer, ContentEditable, HistoryPlugin, RichTextPlugin } from "svelte-lexical";

	import LabelWithTips from "$lib/components/buss/label-with-tips/label-with-tips.svelte";
	import { Label } from "$lib/components/ui/label";
	import { createLogger } from "@shared/logger";
	import ClearEditorBtn from "./clear-editor-btn.svelte";
	import { CustomTextNode } from "./nodes/custom-text-node";
	import { VariableValueNode } from "./nodes/variable-value-node";
	import ExternalUpdatePlugin from "./plugins/external-update-plugin.svelte";
	import OnBlurOrFocusPlugin from "./plugins/on-blur-or-focus-plugin.svelte";
	import OnChangePlugin from "./plugins/on-change-plugin.svelte";
	import VariablePlugin from "./plugins/variable-plugin.svelte";
	import { isLexicalEditorState, textJsonToEditorState } from "./utils";

	const logger = createLogger("ui");

	interface Props {
		label?: string;
		tips?: string;
		value?: string | null | undefined;
		isSystemPrompt?: boolean;
		wrapperClass?: string;
		class?: string;
		canReset?: boolean;
		onReset?: () => void;
		onchange?: (content: string, rawJson: string) => void;
		onEditorReady?: (editor: LexicalEditor) => void;
		onFocus?: () => void;
		onBlur?: () => void;
		topBar?: import("svelte").Snippet;
		right?: import("svelte").Snippet;
		readonly?: boolean;
		resize?: boolean;
	}

	let {
		label = "",
		tips,
		value = $bindable(),
		isSystemPrompt = false,
		wrapperClass = "",
		class: className = "",
		canReset = false,
		onReset,
		onchange,
		onEditorReady,
		onFocus,
		onBlur,
		topBar,
		right,
		readonly = false,
		resize = false,
	}: Props = $props();

	let composer: Composer | undefined = $state();
	let editorReady = $state(false);
	let initialValueSet = $state(false);

	const initialConfig = {
		namespace: "prompt-editor",
		nodes: [
			VariableValueNode,
			CustomTextNode,
			{
				replace: TextNode,
				withKlass: CustomTextNode,
				with: (node: TextNode) => new CustomTextNode(node.__text),
			},
		],
		// Don't set editorState here, we'll set it after editor is ready
		// This ensures node types are fully registered before parsing JSON
		onError: (error: Error) => {
			logger.error("Lexical error:", error);
		},
	};

	function handleChange() {
		if (!composer || !editorReady) return;
		const editor = composer.getEditor();
		if (!editor) return;

		const editorState = editor.getEditorState();
		const text = editorState.read(() => {
			return getRoot()
				.getChildren()
				.map((p) => p.getTextContent())
				.join("\n");
		});
		const rawJson = JSON.stringify(editorState.toJSON());

		value = rawJson;
		onchange?.(text, rawJson);
	}

	onMount(() => {
		// Wait for composer to be ready
		const checkReady = setInterval(() => {
			if (composer) {
				const editor = composer.getEditor();
				if (editor) {
					clearInterval(checkReady);

					// Set initial value after editor is ready (node types are registered)
					if (value && !initialValueSet) {
						initialValueSet = true;
						// If value is already Lexical JSON, parse and set directly
						if (isLexicalEditorState(value)) {
							try {
								const parsed = editor.parseEditorState(value);
								// Try to set editor state in try-catch, if it fails use fallback
								editor.setEditorState(parsed);
							} catch (error) {
								logger.error("Failed to set editor state, using fallback:", error);
								// Fallback to safe empty state
								const safeJson = textJsonToEditorState("");
								if (safeJson) {
									const safeParsed = editor.parseEditorState(safeJson);
									editor.setEditorState(safeParsed);
								}
							}
						} else {
							// Convert plain text to editor state
							const jsonState = textJsonToEditorState(value);
							if (jsonState) {
								const parsed = editor.parseEditorState(jsonState);
								editor.setEditorState(parsed);
							}
						}
					}

					editorReady = true;
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					onEditorReady?.(editor as any);
				}
			}
		}, 50);

		return () => {
			clearInterval(checkReady);
		};
	});
</script>

<Composer {initialConfig} bind:this={composer}>
	<div class="flex flex-col justify-center">
		<div class="flex flex-row gap-x-2 items-center justify-between">
			{#if topBar}
				{@render topBar()}
			{/if}
		</div>
		<div class="flex items-center justify-between h-9">
			{#if tips}
				<LabelWithTips {label} {tips} tooltipPlacement="right" />
			{:else}
				<Label class="text-label-fg">{label}</Label>
			{/if}
			<div class="flex flex-row gap-x-2 items-center justify-between">
				{#if right}
					{@render right()}
				{/if}
				{#if canReset}
					<ClearEditorBtn reset={onReset} />
				{/if}
			</div>
		</div>

		<div
			class={cn(
				"relative rounded-lg border bg-input transition-colors focus-within:ring-2 focus-within:ring-primary",
				wrapperClass,
			)}
		>
			<div
				class={cn(
					"h-[150px] w-full",
					"[&_p]:m-0 [&_p]:min-h-[1.5em] overflow-auto",
					className,
					resize && "resize-y",
				)}
			>
				<ContentEditable
					className={`${readonly ? "pointer-events-none" : ""} h-full px-3 py-2 resize-none text-sm leading-relaxed focus:outline-none`}
				/>
			</div>
			<RichTextPlugin />
			<HistoryPlugin />

			<!-- Custom plugins -->
			<VariablePlugin {isSystemPrompt} />
			<ExternalUpdatePlugin />
			<OnBlurOrFocusPlugin {onFocus} {onBlur} />

			<!-- onChange listener -->
			<OnChangePlugin onChange={handleChange} />
		</div>
	</div>
</Composer>

<style>
	:global(.variable-chip-wrapper) {
		display: inline-flex;
		vertical-align: middle;
	}
</style>
