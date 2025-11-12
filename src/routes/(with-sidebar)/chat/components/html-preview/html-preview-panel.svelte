<script lang="ts">
	import { deployHtmlTo302, validate302Provider } from "$lib/api/webserve-deploy";
	import PreviewPanel from "$lib/components/html-preview/preview-panel.svelte";
	import * as m from "$lib/paraglide/messages";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { codeAgentState } from "$lib/stores/code-agent";
	import {
		htmlPreviewDeploymentsState,
		type HtmlPreviewDeploymentRecord,
	} from "$lib/stores/html-preview-deployments-state.svelte";
	import { htmlPreviewState, type HtmlPreviewContext } from "$lib/stores/html-preview-state.svelte";
	import { persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
	import { toast } from "svelte-sonner";
	import EditorPanel from "./editor-panel.svelte";
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
	let editorPanelRef: EditorPanel | null = $state(null);
	let activeTab = $state<"preview" | "code">("preview");
	let deviceMode = $state<"desktop" | "mobile">("desktop");
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
		handleModeSwitch(tab === "preview" ? "preview" : "edit");
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

{#if htmlPreviewState.isVisible}
	<div
		class="h-full min-w-0 max-w-full overflow-hidden border-l border-border bg-background flex flex-col"
		style="min-height: 0; max-height: 100%;"
	>
		<!-- Header -->
		<PreviewHeader
			{activeTab}
			{deviceMode}
			{isDeploying}
			{deployedUrl}
			onTabChange={handleTabChange}
			onDeviceModeChange={handleDeviceModeChange}
			onDeploy={handleDeploy}
			onClose={() => htmlPreviewState.closePreview()}
			onOpenDeployedUrl={openDeployedUrl}
			onOpenInNewTab={handleOpenInNewTab}
			onCopyDeployedUrl={handleCopyDeploymentUrl}
		/>

		<!-- Content area -->
		<div class="flex-1 flex flex-col" style="min-height: 0;">
			{#if htmlPreviewState.mode === "preview"}
				<PreviewPanel html={htmlPreviewState.editedHtml} {deviceMode} />
			{:else}
				<EditorPanel
					bind:this={editorPanelRef}
					value={htmlPreviewState.editedHtml}
					language={htmlPreviewState.selectedLanguage}
					onValueChange={handleValueChange}
					readOnly={!isAgentMode}
				/>
			{/if}
		</div>
	</div>
{/if}
