<script lang="ts">
	import type {
		Options as MarkdownItOptions,
		PluginSimple,
		PluginWithOptions,
		PresetName,
	} from "markdown-it";
	import markdownIt from "markdown-it";
	import type Token from "markdown-it/lib/token.mjs";
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
	interface RenderedBlock {
		id: string;
		html: string;
		tokens: Token[];
	}
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
	}
	const DEFAULT_OPTIONS: Readonly<MarkdownItOptions> = Object.freeze({
		html: false,
		linkify: true,
		typographer: true,
	});
	const hashString = (input: string): string => {
		let hash = 2166136261;
		for (let index = 0; index < input.length; index += 1) {
			hash ^= input.charCodeAt(index);
			hash = Math.imul(hash, 16777619);
		}
		return (hash >>> 0).toString(36);
	};
	const tokensSignature = (tokens: Token[]): string =>
		tokens
			.map((token) => `${token.type}:${token.tag}:${token.level}:${token.nesting}:${token.content}`)
			.join("|");
	const allocateBlockId = (signature: string, counts: Map<string, number>): string => {
		const occurrence = counts.get(signature) ?? 0;
		counts.set(signature, occurrence + 1);
		return `${hashString(signature)}-${occurrence}`;
	};
	const segmentTokens = (tokens: Token[]): Token[][] => {
		const segments: Token[][] = [];
		let cursor = 0;
		while (cursor < tokens.length) {
			const token = tokens[cursor];
			if (!token.block || token.level !== 0 || token.nesting === -1) {
				cursor += 1;
				continue;
			}
			if (token.nesting === 0) {
				segments.push([token]);
				cursor += 1;
				continue;
			}
			const start = cursor;
			let depth = token.nesting;
			cursor += 1;
			while (cursor < tokens.length && depth > 0) {
				const current = tokens[cursor];
				if (current.nesting === 1) {
					depth += 1;
				} else if (current.nesting === -1) {
					depth -= 1;
				}
				cursor += 1;
			}
			segments.push(tokens.slice(start, cursor));
		}
		return segments;
	};
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
	const createInstance = ({
		preset,
		options,
		plugins,
		configure,
		onInstance,
	}: {
		preset: PresetName | null | undefined;
		options: MarkdownItOptions | undefined;
		plugins: MarkdownPluginInput[] | undefined;
		configure: ConfigureMarkdownIt | undefined;
		onInstance: InstanceCallback | undefined;
	}): MarkdownItInstance => {
		const effectiveOptions = {
			...DEFAULT_OPTIONS,
			...(options ?? {}),
		};
		const instance = preset ? markdownIt(preset, effectiveOptions) : markdownIt(effectiveOptions);
		for (const { plugin, options: pluginOptions } of normalizePlugins(plugins)) {
			instance.use(plugin as PluginWithOptions<unknown>, pluginOptions);
		}
		configure?.(instance);
		onInstance?.(instance);
		return instance;
	};
	const renderMarkdown = ({
		instance,
		content,
		inline,
		env,
		transform,
	}: {
		instance: MarkdownItInstance;
		content: string;
		inline: boolean;
		env: MarkdownEnvironment | undefined;
		transform: TransformRenderedHtml | undefined;
	}): RenderedBlock[] => {
		const envState: MarkdownEnvironment = env ? { ...env } : {};
		if (inline) {
			const inlineTokens = instance.parseInline(content, envState);
			const signatureCounts = new Map<string, number>();
			const signature = tokensSignature(inlineTokens);
			const html = instance.renderer.renderInline(inlineTokens, instance.options, envState);
			const transformed =
				transform?.(html, {
					env: envState,
					tokens: inlineTokens,
					renderer: instance,
				}) ?? html;
			return [
				{
					id: allocateBlockId(signature, signatureCounts),
					html: transformed,
					tokens: inlineTokens,
				},
			];
		}
		const tokens = instance.parse(content, envState);
		const blocks = segmentTokens(tokens);
		const signatureCounts = new Map<string, number>();
		return blocks.map((blockTokens) => {
			const signature = tokensSignature(blockTokens);
			const id = allocateBlockId(signature, signatureCounts);
			const blockHtml = instance.renderer.render(blockTokens, instance.options, envState);
			const transformed =
				transform?.(blockHtml, {
					env: envState,
					tokens: blockTokens,
					renderer: instance,
				}) ?? blockHtml;
			return {
				id,
				html: transformed,
				tokens: blockTokens,
			};
		});
	};
	const props: Props = $props();

	const renderer = $derived.by(() =>
		createInstance({
			preset: props.preset ?? "default",
			options: props.options,
			plugins: props.plugins ?? [],
			configure: props.configure,
			onInstance: props.onInstance,
		}),
	);

	const renderedBlocks = $derived.by(() =>
		renderMarkdown({
			instance: renderer,
			content: props.content,
			inline: props.inline ?? false,
			env: props.env,
			transform: props.transform,
		}),
	);
</script>

<div class="prose max-w-none">
	{#each renderedBlocks as block (block.id)}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html block.html}
	{/each}
</div>
