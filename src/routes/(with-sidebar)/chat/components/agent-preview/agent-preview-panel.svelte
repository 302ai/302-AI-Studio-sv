<script lang="ts">
	import { deployHtmlTo302, validate302Provider } from "$lib/api/webserve-deploy";
	import { getFileContent, type SandboxFileInfo } from "$lib/api/sandbox-file";
	import CodeMirrorEditor from "$lib/components/buss/editor/codemirror-editor.svelte";
	import PreviewPanel from "$lib/components/html-preview/preview-panel.svelte";
	import * as m from "$lib/paraglide/messages";
	import { agentPreviewState } from "$lib/stores/agent-preview-state.svelte";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { claudeCodeAgentState, codeAgentState } from "$lib/stores/code-agent";
	import {
		htmlPreviewDeploymentsState,
		type HtmlPreviewDeploymentRecord,
	} from "$lib/stores/html-preview-deployments-state.svelte";
	import { htmlPreviewState, type HtmlPreviewContext } from "$lib/stores/html-preview-state.svelte";
	import { persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
	import { Loader2 } from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import FileTree from "./file-tree.svelte";
	import PreviewHeader from "./preview-header.svelte";

	const LANGUAGE_OPTIONS = [
		{ label: "Markdown", value: "markdown" },
		{ label: "Text", value: "text" },
		{ label: "JavaScript", value: "javascript" },
		{ label: "TypeScript", value: "typescript" },
		{ label: "Python", value: "python" },
		{ label: "CSS", value: "css" },
		{ label: "HTML", value: "html" },
		{ label: "JSON", value: "json" },
		{ label: "XML", value: "xml" },
		{ label: "SVG", value: "svg" },
		{ label: "Shell", value: "shell" },
	] as const;

	let _isSaving = $state(false);
	let isDeploying = $state(false);
	let currentPreviewId = $state<string | null>(null);
	let deploymentHistory = $state<HtmlPreviewDeploymentRecord[]>([]);
	let editorPanelRef: CodeMirrorEditor | null = $state(null);
	let activeTab = $state<"preview" | "code">("preview");
	let deviceMode = $state<"desktop" | "mobile">("desktop");

	// File viewer state
	let selectedFile = $state<SandboxFileInfo | null>(null);
	let fileContent = $state<string>("");
	let loadingFileContent = $state(false);
	let fileLanguage = $state<string>("text");

	const latestDeployment = $derived(
		deploymentHistory.length > 0 ? deploymentHistory[deploymentHistory.length - 1] : null,
	);
	const deployedUrl = $derived(latestDeployment ? latestDeployment.url : null);
	const isAgentMode = $derived(codeAgentState.enabled);

	// 获取当前语言的显示标签
	const _currentLanguageLabel = $derived(() => {
		const value = htmlPreviewState.selectedLanguage ?? "auto";
		const option = LANGUAGE_OPTIONS.find((opt) => opt.value === value);
		return option?.label ?? "Auto";
	});

	const _isDirty = $derived(
		() =>
			htmlPreviewState.editedHtml !== (htmlPreviewState.initialHtml ?? "") ||
			(htmlPreviewState.selectedLanguage ?? null) !== (htmlPreviewState.initialLanguage ?? null),
	);

	const handleModeSwitch = (mode: "preview" | "edit") => {
		htmlPreviewState.setMode(mode);
		if (mode === "edit") {
			// Focus editor when switching to edit mode
			requestAnimationFrame(() => {
				editorPanelRef?.focus();
			});
		}
	};

	const _handleReset = () => {
		htmlPreviewState.resetToInitial();
	};

	const _handleSave = async () => {
		if (!htmlPreviewState.context) {
			toast.error(m.toast_save_no_context());
			return;
		}

		_isSaving = true;
		try {
			const { messageId, messagePartIndex, blockId, meta } = htmlPreviewState.context;
			// 如果 selectedLanguage 为 null（用户选择了"自动识别"），传 undefined 以保留原语言
			// 如果 selectedLanguage 有值，传该值以更新语言
			const normalizedLanguage =
				htmlPreviewState.selectedLanguage === null ? undefined : htmlPreviewState.selectedLanguage;

			const success = chatState.updateMessageCodeBlock(
				messageId,
				messagePartIndex,
				blockId,
				htmlPreviewState.editedHtml,
				normalizedLanguage,
				meta,
			);

			if (!success) {
				toast.error(m.toast_save_failed());
				return;
			}

			htmlPreviewState.commitChanges();
			toast.success(m.toast_save_success());
		} catch (error) {
			console.error("保存 HTML 预览内容失败", error);
			toast.error(m.toast_save_failed());
		} finally {
			_isSaving = false;
		}
	};

	const handleValueChange = (value: string) => {
		htmlPreviewState.setEditedHtml(value);
	};

	// 根据文件扩展名检测语言
	function detectLanguage(filename: string): string {
		const ext = filename.split(".").pop()?.toLowerCase();
		const languageMap: Record<string, string> = {
			js: "javascript",
			jsx: "javascript",
			ts: "typescript",
			tsx: "typescript",
			py: "python",
			md: "markdown",
			json: "json",
			html: "html",
			css: "css",
			xml: "xml",
			svg: "svg",
			sh: "shell",
			bash: "shell",
			txt: "text",
		};
		return languageMap[ext || ""] || "text";
	}

	// 获取 302.AI API key
	const get302ApiKey = () => {
		const provider = persistedProviderState.current.find((p) => p.name === "302.AI" && p.enabled);
		return provider?.apiKey || "";
	};

	// 处理文件选择
	async function handleFileSelect(file: SandboxFileInfo) {
		selectedFile = file;
		loadingFileContent = true;
		fileLanguage = detectLanguage(file.name);

		try {
			const apiKey = get302ApiKey();
			if (!apiKey) {
				toast.error("302.AI API key not found");
				return;
			}

			fileContent = await getFileContent(claudeCodeAgentState.sandboxId, file.path, apiKey);
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : "Failed to load file content";
			toast.error(errorMsg);
			console.error("[AgentPreview] Failed to load file:", e);
		} finally {
			loadingFileContent = false;
		}
	}

	const buildPreviewId = (context: HtmlPreviewContext) =>
		`${context.messageId}:${context.messagePartIndex}:${context.blockId}`;

	$effect(() => {
		const context = htmlPreviewState.context;
		const historyMap = htmlPreviewDeploymentsState.state;

		if (!context) {
			currentPreviewId = null;
			deploymentHistory = [];
			return;
		}

		const previewId = buildPreviewId(context);
		currentPreviewId = previewId;
		deploymentHistory = historyMap[previewId] ?? [];
	});

	const handleDeploy = async () => {
		// Validate 302.AI provider
		const validation = validate302Provider(persistedProviderState.current);

		if (!validation.valid) {
			// Display appropriate error message
			if (validation.error === "toast_deploy_no_302_provider") {
				toast.error(m.toast_deploy_no_302_provider());
			} else if (validation.error === "toast_deploy_302_provider_disabled") {
				toast.error(m.toast_deploy_302_provider_disabled());
			} else {
				toast.error(validation.error || m.toast_deploy_failed());
			}
			return;
		}

		if (!validation.provider) {
			toast.error(m.toast_deploy_failed());
			return;
		}

		isDeploying = true;

		try {
			const result = await deployHtmlTo302(validation.provider, {
				html: htmlPreviewState.editedHtml,
				title: "HTML Preview Deploy",
				description: "Deployed from 302 AI Studio",
			});

			if (!result.success || !result.data) {
				toast.error(m.toast_deploy_failed(), {
					description: result.error || "Unknown error",
				});
				return;
			}

			const record: HtmlPreviewDeploymentRecord = {
				url: result.data.url,
				deployedAt: new Date().toISOString(),
			};

			if (currentPreviewId) {
				htmlPreviewDeploymentsState.append(currentPreviewId, record);
			} else {
				deploymentHistory = [...deploymentHistory, record];
			}

			toast.success(m.toast_deploy_success());

			// Copy URL to clipboard
			try {
				await navigator.clipboard.writeText(result.data.url);
				// toast.success(m.toast_deploy_url_copied());
			} catch (clipboardError) {
				console.error("Failed to copy URL to clipboard:", clipboardError);
			}
		} catch (error) {
			console.error("Deploy HTML failed:", error);
			toast.error(m.toast_deploy_failed(), {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			isDeploying = false;
		}
	};

	const openDeployedUrl = () => {
		if (latestDeployment) {
			window.open(latestDeployment.url, "_blank");
		}
	};

	const handleTabChange = (tab: "preview" | "code") => {
		activeTab = tab;
	};

	const handleDeviceModeChange = (mode: "desktop" | "mobile") => {
		deviceMode = mode;
	};

	const _handleEnableAgentMode = () => {
		if (isAgentMode) {
			return;
		}
		codeAgentState.updateState({ enabled: true });
	};

	const handleCopyDeploymentUrl = async () => {
		if (!latestDeployment) {
			return;
		}
		try {
			await navigator.clipboard.writeText(latestDeployment.url);
			toast.success(m.toast_deploy_url_copied());
		} catch (error) {
			console.error("Copy deployed url failed:", error);
			toast.error(m.toast_copied_failed());
		}
	};

	const handleOpenInNewTab = async () => {
		const htmlContent = htmlPreviewState.editedHtml;
		const context = htmlPreviewState.context;

		// Generate unique previewId based on message and block info
		const previewId = context
			? `${context.messageId}-${context.messagePartIndex}-${context.blockId}`
			: undefined;

		// 创建新的 htmlPreview 类型标签页，直接传递 HTML 内容
		await tabBarState.handleNewTab(
			m.title_html_preview(),
			"htmlPreview",
			true,
			"/html-preview",
			htmlContent,
			previewId,
		);
	};
</script>

<!-- 始终渲染此 DOM，但通过 CSS 隐藏，以确保 $effect 能够执行 -->
<div style="display: contents;">
	{#if agentPreviewState.isVisible}
		<div
			class="h-full min-w-0 max-w-full overflow-hidden border-l border-border bg-background flex flex-col"
			style="min-height: 0; max-height: 100%;"
		>
			<!-- Header - 保留原有的 Header 和 Tab 切换 -->
			<PreviewHeader
				{activeTab}
				{deviceMode}
				{isDeploying}
				{deployedUrl}
				onTabChange={handleTabChange}
				onDeviceModeChange={handleDeviceModeChange}
				onDeploy={handleDeploy}
				onClose={() => agentPreviewState.closePreview()}
				onOpenDeployedUrl={openDeployedUrl}
				onOpenInNewTab={handleOpenInNewTab}
				onCopyDeployedUrl={handleCopyDeploymentUrl}
			/>

			<!-- Content area - 分为左右两栏 -->
			<div class="flex flex-1" style="min-height: 0;">
				<!-- File Tree Sidebar (左侧) -->
				<div class="w-64 flex-shrink-0 border-r border-border overflow-hidden">
					<FileTree sandboxId={claudeCodeAgentState.sandboxId} onFileSelect={handleFileSelect} />
				</div>

				<!-- Preview/Editor Area (右侧) -->
				<div class="flex-1 flex flex-col" style="min-height: 0;">
					{#if activeTab === "preview"}
						<!-- Preview Mode -->
						{#if selectedFile}
							<PreviewPanel html={fileContent} {deviceMode} />
						{:else}
							<div class="flex h-full items-center justify-center text-muted-foreground">
								<div class="text-center">
									<p class="text-sm">Select a file to preview</p>
								</div>
							</div>
						{/if}
					{:else}
						<!-- Code Mode -->
						{#if selectedFile}
							<!-- File header -->
							<div
								class="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2"
							>
								<div class="flex items-center gap-2">
									<span class="text-sm font-medium">{selectedFile.name}</span>
									<span class="text-xs text-muted-foreground">{selectedFile.path}</span>
								</div>
							</div>

							<!-- Editor -->
							<div class="flex-1" style="min-height: 0;">
								{#if loadingFileContent}
									<div class="flex h-full items-center justify-center">
										<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
									</div>
								{:else}
									<CodeMirrorEditor
										bind:this={editorPanelRef}
										value={fileContent}
										language={fileLanguage}
										readOnly={true}
									/>
								{/if}
							</div>
						{:else}
							<div class="flex h-full items-center justify-center text-muted-foreground">
								<div class="text-center">
									<p class="text-sm">Select a file to view its content</p>
								</div>
							</div>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
