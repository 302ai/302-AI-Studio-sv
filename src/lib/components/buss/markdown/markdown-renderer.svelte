<script lang="ts">
	import katex from "katex";
	import "katex/dist/katex.min.css";
	import markdownIt, {
		type Options as MarkdownItOptions,
		type PluginSimple,
		type PluginWithOptions,
		type PresetName,
	} from "markdown-it";
	import texmath from "markdown-it-texmath";
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
		messageId?: string;
		messagePartIndex?: number;
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

		// Add comprehensive math support with multiple delimiters and enhanced features
		instance.use(texmath, {
			engine: katex,
			delimiters: "dollars", // Supports: $...$ (inline), $$...$$ (display)
			katexOptions: {
				// Error handling - show error message instead of throwing
				throwOnError: false,
				errorColor: "#cc0000",

				// Display and sizing options
				displayMode: false, // Auto-detect based on delimiters
				fleqn: false, // Left-aligned equations
				leqno: false, // Equation numbers on left

				// Font and styling
				minRuleThickness: 0.04, // Minimum line thickness
				maxSize: Infinity, // Maximum font size
				maxExpand: 1000, // Maximum macro expansions

				// Trust and security
				trust: true, // Enable \url, \href and HTML in math
				strict: false, // Allow more LaTeX features

				// Output options
				output: "html", // HTML output for better rendering

				// Extensive macro definitions for common mathematical notation
				macros: {
					// Number sets
					"\\N": "\\mathbb{N}", // Natural numbers
					"\\Z": "\\mathbb{Z}", // Integers
					"\\Q": "\\mathbb{Q}", // Rational numbers
					"\\R": "\\mathbb{R}", // Real numbers
					"\\RR": "\\mathbb{R}", // Alternative for reals
					"\\C": "\\mathbb{C}", // Complex numbers
					"\\F": "\\mathbb{F}", // Field
					"\\H": "\\mathbb{H}", // Quaternions
					"\\PP": "\\mathbb{P}", // Projective space

					// Calligraphic and script letters
					"\\calA": "\\mathcal{A}",
					"\\calB": "\\mathcal{B}",
					"\\calC": "\\mathcal{C}",
					"\\calD": "\\mathcal{D}",
					"\\calE": "\\mathcal{E}",
					"\\calF": "\\mathcal{F}",
					"\\calG": "\\mathcal{G}",
					"\\calH": "\\mathcal{H}",
					"\\calK": "\\mathcal{K}",
					"\\calL": "\\mathcal{L}",
					"\\calM": "\\mathcal{M}",
					"\\calN": "\\mathcal{N}",
					"\\calO": "\\mathcal{O}",
					"\\calP": "\\mathcal{P}",
					"\\calS": "\\mathcal{S}",
					"\\calT": "\\mathcal{T}",
					"\\calU": "\\mathcal{U}",
					"\\calV": "\\mathcal{V}",
					"\\calW": "\\mathcal{W}",
					"\\calX": "\\mathcal{X}",
					"\\calY": "\\mathcal{Y}",
					"\\calZ": "\\mathcal{Z}",

					// Common operators
					"\\eps": "\\varepsilon",
					"\\epsilon": "\\varepsilon",
					"\\vphi": "\\varphi",
					"\\deg": "\\mathrm{deg}",
					"\\tr": "\\mathrm{tr}",
					"\\rank": "\\mathrm{rank}",
					"\\dim": "\\mathrm{dim}",
					"\\ker": "\\mathrm{ker}",
					"\\im": "\\mathrm{im}",
					"\\coker": "\\mathrm{coker}",
					"\\Hom": "\\mathrm{Hom}",
					"\\End": "\\mathrm{End}",
					"\\Aut": "\\mathrm{Aut}",
					"\\Isom": "\\mathrm{Isom}",

					// Probability and statistics
					"\\Pr": "\\mathbb{P}",
					"\\prob": "\\mathbb{P}",
					"\\Ex": "\\mathbb{E}",
					"\\Var": "\\mathrm{Var}",
					"\\Cov": "\\mathrm{Cov}",
					"\\Cor": "\\mathrm{Cor}",

					// Common functions
					"\\argmax": "\\mathop{\\mathrm{arg\\,max}}",
					"\\argmin": "\\mathop{\\mathrm{arg\\,min}}",
					"\\sgn": "\\mathrm{sgn}",
					"\\erf": "\\mathrm{erf}",
					"\\diag": "\\mathrm{diag}",

					// Arrows and relations
					"\\into": "\\hookrightarrow",
					"\\onto": "\\twoheadrightarrow",
					"\\isom": "\\cong",
					"\\iso": "\\cong",
					"\\equiv": "\\Leftrightarrow",
					"\\iff": "\\Leftrightarrow",
					"\\implies": "\\Rightarrow",
					"\\impliedby": "\\Leftarrow",

					// Delimiters (flexible sizing)
					"\\abs": "\\left|#1\\right|",
					"\\norm": "\\left\\|#1\\right\\|",
					"\\ceil": "\\left\\lceil#1\\right\\rceil",
					"\\floor": "\\left\\lfloor#1\\right\\rfloor",
					"\\avg": "\\left\\langle#1\\right\\rangle",
					"\\inner": "\\left\\langle#1\\right\\rangle",
					"\\set": "\\left\\{#1\\right\\}",
					"\\paren": "\\left(#1\\right)",
					"\\bracket": "\\left[#1\\right]",

					// Derivatives and calculus
					"\\diff": "\\mathrm{d}",
					"\\dd": "\\,\\mathrm{d}",
					"\\dv": "\\frac{\\mathrm{d}#1}{\\mathrm{d}#2}",
					"\\pdv": "\\frac{\\partial#1}{\\partial#2}",
					"\\grad": "\\nabla",
					"\\divg": "\\nabla\\cdot",
					"\\curl": "\\nabla\\times",
					"\\laplacian": "\\nabla^2",

					// Linear algebra
					"\\adj": "\\mathrm{adj}",
					"\\span": "\\mathrm{span}",
					"\\nullity": "\\mathrm{nullity}",
					"\\range": "\\mathrm{range}",
					"\\det": "\\mathrm{det}",

					// Logic and boolean
					"\\true": "\\mathrm{true}",
					"\\false": "\\mathrm{false}",

					// Complexity classes
					"\\NP": "\\mathsf{NP}",
					"\\PSPACE": "\\mathsf{PSPACE}",
					"\\EXP": "\\mathsf{EXP}",
					"\\EXPSPACE": "\\mathsf{EXPSPACE}",

					// Misc
					"\\st": "\\text{ s.t. }",
					"\\suchthat": "\\text{ such that }",
					"\\defeq": "\\triangleq",
					"\\define": "\\triangleq",
					"\\given": "\\mid",

					// Additional mathematical symbols and operators
					"\\half": "\\frac{1}{2}",
					"\\quarter": "\\frac{1}{4}",
					"\\third": "\\frac{1}{3}",
					"\\twothirds": "\\frac{2}{3}",

					// Vector notation
					"\\vv": "\\vec{#1}",
					"\\bb": "\\mathbf{#1}",
					"\\bm": "\\boldsymbol{#1}",
					"\\ii": "\\mathbf{i}",
					"\\jj": "\\mathbf{j}",
					"\\kk": "\\mathbf{k}",

					// Matrix and determinant
					"\\mat": "\\begin{matrix}#1\\end{matrix}",
					"\\pmat": "\\begin{pmatrix}#1\\end{pmatrix}",
					"\\bmat": "\\begin{bmatrix}#1\\end{bmatrix}",
					"\\vmat": "\\begin{vmatrix}#1\\end{vmatrix}",
					"\\Vmat": "\\begin{Vmatrix}#1\\end{Vmatrix}",

					// Common limits and integrals
					"\\limn": "\\lim_{n\\to\\infty}",
					"\\liminf": "\\liminf_{#1}",
					"\\limsup": "\\limsup_{#1}",
					"\\sumn": "\\sum_{n=1}^{\\infty}",
					"\\sumk": "\\sum_{k=1}^{\\infty}",
					"\\prodn": "\\prod_{n=1}^{\\infty}",
					"\\prodk": "\\prod_{k=1}^{\\infty}",

					// Differential equations
					"\\ODE": "\\text{ODE}",
					"\\PDE": "\\text{PDE}",

					// Big O notation
					"\\bigO": "\\mathcal{O}",
					"\\littleO": "o",
					"\\bigOmega": "\\Omega",
					"\\bigTheta": "\\Theta",

					// Topology
					"\\interior": "\\text{int}",
					"\\closure": "\\overline{#1}",
					"\\boundary": "\\partial",

					// Abstract algebra
					"\\GL": "\\mathrm{GL}",
					"\\SL": "\\mathrm{SL}",
					"\\SO": "\\mathrm{SO}",
					"\\SU": "\\mathrm{SU}",
					"\\U": "\\mathrm{U}",
					"\\Sp": "\\mathrm{Sp}",

					// Category theory
					"\\Obj": "\\mathrm{Obj}",
					"\\Mor": "\\mathrm{Mor}",
					"\\id": "\\mathrm{id}",
					"\\op": "\\mathrm{op}",

					// Theorems and proofs
					"\\qed": "\\square",
					"\\contradiction": "\\Rightarrow\\!\\Leftarrow",
				},
			},
		});

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

				const rawInfo = (token.info || "").trim();
				const languageParts = rawInfo.split(/\s+/);
				const language = languageParts[0] || null;

				descriptors.push({
					id: `code-${codeIndex}`,
					kind: "code",
					code: token.content ?? "",
					language: language,
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

	const handleExternalLinks = (node: HTMLElement) => {
		const links = node.querySelectorAll("a");

		const handleClick = (event: MouseEvent) => {
			event.preventDefault();
			const target = event.currentTarget as HTMLAnchorElement;
			const url = target.href;
			if (url && window.electronAPI?.externalLinkService?.openExternalLink) {
				window.electronAPI.externalLinkService.openExternalLink(url);
			}
		};

		links.forEach((link) => {
			link.addEventListener("click", handleClick);
		});

		return {
			destroy() {
				links.forEach((link) => {
					link.removeEventListener("click", handleClick);
				});
			},
		};
	};
</script>

<div class="prose max-w-none [&_a]:break-all">
	{#each blocks as block (block.id)}
		{#if block.kind === "code"}
			<CodeBlock
				blockId={block.id}
				code={block.code}
				language={block.language}
				meta={block.meta}
				theme={props.codeTheme ?? DEFAULT_THEME}
				messageId={props.messageId}
				messagePartIndex={props.messagePartIndex}
			/>
		{:else}
			<div use:handleExternalLinks>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html block.html}
			</div>
		{/if}
	{/each}
</div>
