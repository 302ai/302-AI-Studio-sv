<script lang="ts">
	import markdownIt, {
		type Options as MarkdownItOptions,
		type PluginSimple,
		type PluginWithOptions,
		type PresetName,
	} from "markdown-it";
	import type Token from "markdown-it/lib/token.mjs";
	import { onMount } from "svelte";
	import CodeBlock from "./code-block.svelte";
	import { DEFAULT_THEME, ensureHighlighter } from "./highlighter";

	type MarkdownItInstance = ReturnType<typeof markdownIt>;
	type MarkdownEnvironment = Record<string, unknown>;
	type MarkdownPlugin = PluginSimple | PluginWithOptions<unknown>;
	type MarkdownPluginTuple = readonly [MarkdownPlugin, unknown?];
	interface MarkdownPluginObject {
		plugin: MarkdownPlugin;
		options?: unknown;
	}
	type MarkdownPluginInput = MarkdownPlugin | MarkdownPluginTuple | MarkdownPluginObject;
	type ConfigureMarkdownIt = (instance: MarkdownItInstance) => void;
	interface TransformContext {
		env: MarkdownEnvironment;
		tokens: Token[];
		renderer: MarkdownItInstance;
	}
	type TransformRenderedHtml = (html: string, context: TransformContext) => string;
	type InstanceCallback = (instance: MarkdownItInstance) => void;

	interface Props {
		content: string;
		preset?: PresetName | null;
		options?: MarkdownItOptions;
		inline?: boolean;
		env?: MarkdownEnvironment;
		plugins?: MarkdownPluginInput[];
		configure?: ConfigureMarkdownIt;
		onInstance?: InstanceCallback;
		transform?: TransformRenderedHtml;
		codeTheme?: string;
	}

	type BlockDescriptor =
		| { id: string; kind: "html"; html: string }
		| {
				id: string;
				kind: "code";
				code: string;
				language: string | null;
				meta: string | null;
		  };

	const DEFAULT_OPTIONS: Readonly<MarkdownItOptions> = Object.freeze({
		html: false,
		linkify: true,
		typographer: true,
	});

	const props: Props = $props();
	void props.content;

	let renderer: MarkdownItInstance;
	let blocks = $state<BlockDescriptor[]>([]);
	let lastConfigSignature = "";
	let lastContentSnapshot = "";

	const normalizePlugins = (plugins: MarkdownPluginInput[] = []): MarkdownPluginObject[] =>
		plugins.map((entry) => {
			if (typeof entry === "function") {
				return { plugin: entry } satisfies MarkdownPluginObject;
			}
			if (Array.isArray(entry)) {
				const [plugin, options] = entry;
				return { plugin, options } satisfies MarkdownPluginObject;
			}
			return entry as MarkdownPluginObject;
		});

	const createRenderer = (): MarkdownItInstance => {
		const effectiveOptions = {
			...DEFAULT_OPTIONS,
			...(props.options ?? {}),
		};
		const instance = props.preset
			? markdownIt(props.preset, effectiveOptions)
			: markdownIt(effectiveOptions);
		for (const { plugin, options } of normalizePlugins(props.plugins ?? [])) {
			instance.use(plugin as PluginWithOptions<unknown>, options);
		}
		props.configure?.(instance);
		props.onInstance?.(instance);
		return instance;
	};

	const collectBlocks = (markdown: string) => {
		renderer = createRenderer();

		const envState: MarkdownEnvironment = props.env ? { ...props.env } : {};
		const tokens = props.inline
			? renderer.parseInline(markdown, envState)
			: renderer.parse(markdown, envState);

		if (props.inline) {
			const html = renderer.renderer.render(tokens, renderer.options, envState);
			blocks = [
				{
					id: "inline-html",
					kind: "html",
					html: props.transform?.(html, { env: envState, tokens, renderer }) ?? html,
				},
			];
			return;
		}

		const descriptors: BlockDescriptor[] = [];
		let sliceStart = 0;
		let htmlEnv = { ...envState };
		let codeIndex = 0;

		const pushHtml = (tokenSlice: Token[]) => {
			if (!tokenSlice.length) return;
			const html = renderer.renderer.render(tokenSlice, renderer.options, htmlEnv);
			const transformed =
				props.transform?.(html, {
					env: htmlEnv,
					tokens: tokenSlice,
					renderer,
				}) ?? html;
			descriptors.push({ id: `html-${descriptors.length}`, kind: "html", html: transformed });
			htmlEnv = { ...envState };
		};

		for (let index = 0; index < tokens.length; index += 1) {
			const token = tokens[index];
			if (token.type === "fence" && token.tag === "code") {
				const slice = tokens.slice(sliceStart, index);
				pushHtml(slice);

				descriptors.push({
					id: `code-${codeIndex}`,
					kind: "code",
					code: token.content ?? "",
					language: (token.info || "").split(/\s+/)[0] || null,
					meta: token.info?.replace(/^\s*\S+\s*/, "")?.trim() || null,
				});
				codeIndex += 1;
				sliceStart = index + 1;
			}
		}

		if (sliceStart < tokens.length) {
			const remaining = tokens.slice(sliceStart);
			pushHtml(remaining);
		}

		blocks = descriptors;
	};

	onMount(() => {
		ensureHighlighter().catch((error) => {
			console.error("Failed to warm up highlighter", error);
		});
	});

	$effect(() => {
		const configSignature = JSON.stringify([
			props.preset ?? "default",
			props.codeTheme ?? DEFAULT_THEME,
			props.options ?? null,
			props.plugins ?? null,
			props.configure ? true : false,
			props.inline ? "inline" : "block",
		]);
		const { content } = props;
		if (configSignature !== lastConfigSignature || content !== lastContentSnapshot) {
			lastConfigSignature = configSignature;
			lastContentSnapshot = content;
			collectBlocks(content);
		}
	});
</script>

<div class="prose max-w-none">
	{#each blocks as block (block.id)}
		{#if block.kind === "code"}
			<CodeBlock
				blockId={block.id}
				code={block.code}
				language={block.language}
				meta={block.meta}
				theme={props.codeTheme ?? DEFAULT_THEME}
			/>
		{:else}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html block.html}
		{/if}
	{/each}
</div>
