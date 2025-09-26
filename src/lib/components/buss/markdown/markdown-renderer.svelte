<script lang="ts">
	import type {
		Options as MarkdownItOptions,
		PluginSimple,
		PluginWithOptions,
		PresetName,
	} from "markdown-it";
	import markdownIt from "markdown-it";
	import Token from "markdown-it/lib/token.mjs";
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
	}
	const DEFAULT_OPTIONS: Readonly<MarkdownItOptions> = Object.freeze({
		html: false,
		linkify: true,
		typographer: true,
	});
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
	}): string => {
		const source = content;
		const envState: MarkdownEnvironment = env ? { ...env } : {};
		const tokens = inline
			? instance.parseInline(source, envState)
			: instance.parse(source, envState);
		const html = inline
			? instance.renderer.renderInline(tokens, instance.options, envState)
			: instance.renderer.render(tokens, instance.options, envState);
		return transform?.(html, { env: envState, tokens, renderer: instance }) ?? html;
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

	const rendered = $derived.by(() =>
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
	{@html rendered}
</div>
