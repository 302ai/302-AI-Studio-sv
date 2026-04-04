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
	import BlockLoading from "./code-agent/block-loading.svelte";
	import TodoListRenderer from "./code-agent/todo-list-renderer.svelte";
	import WriteToolRenderer from "./code-agent/write-tool-renderer.svelte";
	import CodeBlock from "./code-block.svelte";
	import { DEFAULT_THEME, ensureHighlighter } from "./highlighter";
	import { createLogger } from "@shared/logger";

	const logger = createLogger("ui");

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
		/** Whether the message is currently streaming. When false, tool-loading blocks won't be rendered. */
		isStreaming?: boolean;
	}

	type BlockDescriptor =
		| { id: string; kind: "html"; html: string }
		| {
				id: string;
				kind: "code";
				code: string;
				language: string | null;
				meta: string | null;
		  }
		| {
				id: string;
				kind: "todo";
				todos: Array<{
					content: string;
					status: "pending" | "in_progress" | "completed";
					activeForm: string;
				}>;
		  }
		| {
				id: string;
				kind: "tool-loading";
				toolType: "todo" | "write" | null;
				code: string;
				language: string | null;
		  }
		| {
				id: string;
				kind: "write";
				filePath: string;
				code: string;
				language: string | null;
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
	let lastMessageId = "";

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
			delimiters: ["dollars", "brackets"], // Supports: $...$ \(...\) (inline), $$...$$ \[...\] (display)
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

	const detectTodoWriteJson = (
		code: string,
		language: string | null,
	): {
		isTodoWrite: boolean;
		todos: Array<{
			content: string;
			status: "pending" | "in_progress" | "completed";
			activeForm: string;
		}> | null;
	} => {
		// Only check JSON code blocks
		if (language?.toLowerCase() !== "json") {
			return { isTodoWrite: false, todos: null };
		}

		try {
			const trimmed = code.trim();
			const parsed = JSON.parse(trimmed);

			// Check if it has the todos field with valid structure
			if (
				parsed &&
				typeof parsed === "object" &&
				"todos" in parsed &&
				Array.isArray(parsed.todos)
			) {
				const todos = parsed.todos;

				// Validate that all todos have the required fields
				const isValid = todos.every(
					(todo: unknown) =>
						todo &&
						typeof todo === "object" &&
						"content" in todo &&
						"status" in todo &&
						"activeForm" in todo &&
						typeof (todo as { content: unknown }).content === "string" &&
						typeof (todo as { activeForm: unknown }).activeForm === "string" &&
						["pending", "in_progress", "completed"].includes(
							(todo as { status: string }).status,
						),
				);

				if (isValid && todos.length > 0) {
					return { isTodoWrite: true, todos };
				}
			}
		} catch (_error) {
			return { isTodoWrite: false, todos: null };
		}

		return { isTodoWrite: false, todos: null };
	};

	const detectToolWriteJson = (
		code: string,
		language: string | null,
	): {
		isToolWrite: boolean;
		data: {
			filePath: string;
			code: string;
			language: string | null;
		} | null;
	} => {
		// Only check JSON code blocks
		if (language?.toLowerCase() !== "json") {
			return { isToolWrite: false, data: null };
		}

		try {
			const trimmed = code.trim();
			const parsed = JSON.parse(trimmed);

			// Check if it has file_path field (Write tool)
			if (parsed && typeof parsed === "object" && "file_path" in parsed) {
				const filePath = parsed.file_path;

				if (typeof filePath !== "string" || !filePath) {
					return { isToolWrite: false, data: null };
				}

				const ext = filePath.split(".").pop()?.toLowerCase();
				const languageMap: Record<string, string> = {
					js: "javascript",
					jsx: "javascript",
					ts: "typescript",
					tsx: "typescript",
					py: "python",
					html: "html",
					htm: "html",
					css: "css",
					scss: "scss",
					sass: "sass",
					less: "less",
					json: "json",
					md: "markdown",
					yaml: "yaml",
					yml: "yaml",
					sh: "bash",
					bash: "bash",
					svg: "svg",
					vue: "vue",
					svelte: "svelte",
				};

				const data: {
					filePath: string;
					code: string;
					language: string | null;
				} = {
					filePath,
					code:
						(parsed.content as string) ||
						(parsed.new_string as string) ||
						(parsed.old_string as string) ||
						"",
					language: ext && languageMap[ext] ? languageMap[ext] : ext || "plaintext",
				};

				// At least one code field should exist
				if (data.code) {
					return { isToolWrite: true, data };
				}
			}
		} catch (_error) {
			// Not valid JSON or doesn't match Write tool structure
		}

		return { isToolWrite: false, data: null };
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
		let todoIndex = 0;
		let hasToolCallMarker = false;
		let toolCallType: "todo" | "write" | null = null;

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

		const checkForToolCallMarker = (
			token: Token,
		): { hasMarker: boolean; type: "todo" | "write" | null } => {
			if (token.type === "paragraph_open") {
				const nextToken = tokens[tokens.indexOf(token) + 1];
				if (nextToken?.type === "inline" && nextToken.content) {
					if (nextToken.content.includes("🔧 **Tool Call: TodoWrite**")) {
						return { hasMarker: true, type: "todo" };
					}
					if (nextToken.content.includes("🔧 **Tool Call: Write**")) {
						return { hasMarker: true, type: "write" };
					}
					if (nextToken.content.includes("🔧 **Tool Call: Edit**")) {
						return { hasMarker: true, type: "write" };
					}
				}
			}
			return { hasMarker: false, type: null };
		};

		for (let index = 0; index < tokens.length; index += 1) {
			const token = tokens[index];

			// Check for tool call markers in paragraph tokens
			if (!hasToolCallMarker) {
				const markerCheck = checkForToolCallMarker(token);
				if (markerCheck.hasMarker && markerCheck.type) {
					hasToolCallMarker = true;
					toolCallType = markerCheck.type;
					continue;
				}
			}

			if (token.type === "fence" && token.tag === "code") {
				const slice = tokens.slice(sliceStart, index);
				pushHtml(slice);

				const rawInfo = (token.info || "").trim();
				const languageParts = rawInfo.split(/\s+/);
				const language = languageParts[0] || null;

				// Check if this is a tool call JSON block
				if (hasToolCallMarker && language?.toLowerCase() === "json") {
					// Try to detect the JSON content immediately
					let processedBlock: BlockDescriptor | null = null;

					if (toolCallType === "todo") {
						const todoResult = detectTodoWriteJson(token.content ?? "", language);
						if (todoResult.isTodoWrite && todoResult.todos) {
							processedBlock = {
								id: `todo-${todoIndex}`,
								kind: "todo",
								todos: todoResult.todos,
							};
						}
					} else if (toolCallType === "write") {
						const toolResult = detectToolWriteJson(token.content ?? "", language);
						if (toolResult.isToolWrite && toolResult.data) {
							processedBlock = {
								id: `write-${todoIndex}`,
								kind: "write",
								filePath: toolResult.data.filePath,
								code: toolResult.data.code,
								language: toolResult.data.language,
							};
						}
					}

					if (processedBlock) {
						descriptors.push(processedBlock);
					} else {
						// Create loading state if parsing failed (e.g. incomplete stream)
						descriptors.push({
							id: `tool-loading-${todoIndex}`,
							kind: "tool-loading",
							toolType: toolCallType,
							code: token.content ?? "",
							language: language,
						});
					}

					todoIndex += 1;
					hasToolCallMarker = false;
					toolCallType = null;
				} else {
					// Regular code block
					descriptors.push({
						id: `code-${codeIndex}`,
						kind: "code",
						code: token.content ?? "",
						language: language,
						meta: token.info?.replace(/^\s*\S+\s*/, "")?.trim() || null,
					});
					codeIndex += 1;
				}
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
			logger.error("Failed to warm up highlighter", error);
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
		const { content, messageId } = props;

		// Reset state when message changes or content is cleared
		if (messageId !== lastMessageId || content === "") {
			lastMessageId = messageId ?? "";
		}

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

	/**
	 * Svelte action that applies fade-in animation to newly added text content.
	 * Tracks the previous text length and animates only the new portion.
	 */
	const streamingFadeAction = (node: HTMLElement) => {
		let prevTextLength = 0;
		let animationFrame: number | null = null;

		const applyFadeToNewContent = () => {
			if (!props.isStreaming) {
				prevTextLength = node.textContent?.length || 0;
				return;
			}

			const currentTextLength = node.textContent?.length || 0;

			// Only animate if content was added (not removed or unchanged)
			if (currentTextLength > prevTextLength) {
				// Find all text nodes and wrap new content
				const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
				let charCount = 0;
				const nodesToWrap: { node: Text; startOffset: number; endOffset: number }[] = [];

				while (walker.nextNode()) {
					const textNode = walker.currentNode as Text;
					const nodeLength = textNode.length;
					const nodeStart = charCount;
					const nodeEnd = charCount + nodeLength;

					// Check if this text node contains new content
					if (nodeEnd > prevTextLength) {
						const startOffset = Math.max(0, prevTextLength - nodeStart);
						nodesToWrap.push({
							node: textNode,
							startOffset,
							endOffset: nodeLength,
						});
					}

					charCount += nodeLength;
				}

				// Wrap new content in animated spans
				for (const { node: textNode, startOffset, endOffset } of nodesToWrap.reverse()) {
					if (startOffset < endOffset && textNode.parentNode) {
						const newText = textNode.textContent?.slice(startOffset, endOffset) || "";
						if (newText) {
							const span = document.createElement("span");
							span.className = "streaming-fade-in";
							span.textContent = newText;

							// Split the text node
							const beforeText = textNode.textContent?.slice(0, startOffset) || "";
							textNode.textContent = beforeText;
							textNode.parentNode.insertBefore(span, textNode.nextSibling);

							// Remove animation class after animation completes
							setTimeout(() => {
								if (span.parentNode) {
									const textContent = span.textContent || "";
									const newTextNode = document.createTextNode(textContent);
									span.parentNode.replaceChild(newTextNode, span);
								}
							}, 200);
						}
					}
				}
			}

			prevTextLength = currentTextLength;
		};

		// Use MutationObserver to detect content changes
		const observer = new MutationObserver(() => {
			if (animationFrame) {
				cancelAnimationFrame(animationFrame);
			}
			animationFrame = requestAnimationFrame(applyFadeToNewContent);
		});

		observer.observe(node, {
			childList: true,
			subtree: true,
			characterData: true,
		});

		// Initial setup
		prevTextLength = node.textContent?.length || 0;

		return {
			destroy() {
				observer.disconnect();
				if (animationFrame) {
					cancelAnimationFrame(animationFrame);
				}
			},
		};
	};
</script>

<div class="prose max-w-none [&_a]:break-all" use:streamingFadeAction>
	{#each blocks as block (block.id)}
		{#if block.kind === "code"}
			<div>
				<CodeBlock
					blockId={block.id}
					code={block.code}
					language={block.language}
					meta={block.meta}
					theme={props.codeTheme ?? DEFAULT_THEME}
					messageId={props.messageId}
					messagePartIndex={props.messagePartIndex}
					isStreaming={props.isStreaming}
				/>
			</div>
		{:else if block.kind === "todo"}
			<div>
				<TodoListRenderer todos={block.todos} />
			</div>
		{:else if block.kind === "tool-loading" && block.toolType && props.isStreaming}
			<div>
				<BlockLoading type={block.toolType} />
			</div>
		{:else if block.kind === "write"}
			<div>
				<WriteToolRenderer
					blockId={block.id}
					filePath={block.filePath}
					code={block.code}
					language={block.language}
					theme={props.codeTheme ?? DEFAULT_THEME}
					messageId={props.messageId}
					messagePartIndex={props.messagePartIndex}
				/>
			</div>
		{:else if block.kind === "html"}
			<div use:handleExternalLinks>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html block.html}
			</div>
		{/if}
	{/each}
</div>
