<script lang="ts">
	import { createSkill, createSkillFromGitHub, deleteSkill, updateSkill } from "$lib/api/skills";
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Dialog from "$lib/components/ui/dialog";
	import { m } from "$lib/paraglide/messages";
	import { ChevronLeft, FileEdit, Link, MessageSquareText, Package, X } from "@lucide/svelte";
	import type { Component } from "svelte";
	import { toast } from "svelte-sonner";
	import SkillGithubForm from "./skill-github-form.svelte";
	import SkillHistoryForm from "./skill-history-form.svelte";
	import SkillManualForm from "./skill-manual-form.svelte";
	import SkillUploadForm from "./skill-upload-form.svelte";
	import { createLogger } from "@shared/logger";

	const logger = createLogger("ui");

	export type SkillCreateMethod = "manual" | "upload" | "github" | "history";

	interface CreateOption {
		id: SkillCreateMethod;
		icon: Component;
		titleKey: () => string;
		descKey: () => string;
	}

	interface Props {
		open: boolean;
		onOpenChange?: (open: boolean) => void;
		onCreate?: (method: SkillCreateMethod, data: unknown) => void;
	}

	let { open = $bindable(false), onOpenChange, onCreate }: Props = $props();

	let currentView = $state<"select" | SkillCreateMethod>("select");
	let isCreating = $state(false);

	// Manual creation form data
	const defaultContent = `---
name:
description:
---

# Skill 标题

描述这个 skill 的功能和使用场景...

## 使用方法
...
`;
	let manualFormData = $state({
		name: "",
		description: "",
		content: defaultContent,
	});

	let manualFormRef = $state<SkillManualForm | undefined>();
	let historyFormRef = $state<SkillHistoryForm | undefined>();
	let uploadFormRef = $state<SkillUploadForm | undefined>();
	let githubFormRef = $state<SkillGithubForm | undefined>();

	const createOptions: CreateOption[] = [
		{
			id: "manual",
			icon: FileEdit,
			titleKey: () => m.skills_create_manual(),
			descKey: () => m.skills_create_manual_desc(),
		},
		{
			id: "upload",
			icon: Package,
			titleKey: () => m.skills_create_upload(),
			descKey: () => m.skills_create_upload_desc(),
		},
		{
			id: "github",
			icon: Link,
			titleKey: () => m.skills_create_github(),
			descKey: () => m.skills_create_github_desc(),
		},
		{
			id: "history",
			icon: MessageSquareText,
			titleKey: () => m.skills_create_history(),
			descKey: () => m.skills_create_history_desc(),
		},
	];

	const currentOption = $derived(createOptions.find((opt) => opt.id === currentView));

	function resetState() {
		currentView = "select";
		manualFormData = {
			name: "",
			description: "",
			content: defaultContent,
		};
		// 清理手动创建模式的临时目录
		manualFormRef?.cleanup?.();
		uploadFormRef?.reset();
		githubFormRef?.reset();
	}

	function handleClose() {
		open = false;
		onOpenChange?.(false);
		// Delay reset to allow close animation to complete
		setTimeout(resetState, 150);
	}

	function handleOpenChange(v: boolean) {
		if (!v) {
			// Delay reset to allow close animation to complete
			setTimeout(resetState, 150);
		}
		onOpenChange?.(v);
	}

	function handleSelectOption(optionId: SkillCreateMethod) {
		currentView = optionId;
	}

	function handleBack() {
		uploadFormRef?.reset();
		githubFormRef?.reset();
		currentView = "select";
	}

	function handleConfirmSelect() {
		toast.warning(m.skills_create_select_required());
	}

	async function handleConfirmCreate() {
		if (currentView === "manual") {
			if (!manualFormRef?.validate()) return;

			isCreating = true;
			try {
				// 检查是否使用了文件树视图（有临时目录）
				const manualRootPath = manualFormRef?.getManualRootPath?.();

				if (manualRootPath) {
					// 使用文件树视图，需要写入修改的文件并打包整个目录
					await manualFormRef?.writeChangedFiles?.();

					// 先删除同名 skill 以避免重复
					await deleteSkill({ skill_list: [manualFormData.name] });

					const result = await updateSkill({
						name: manualFormData.name,
						dirPath: manualRootPath,
					});

					if (result.success) {
						toast.success(m.skills_create_success());
						onCreate?.(currentView, { ...manualFormData });
						handleClose();
					} else {
						toast.error(m.skills_create_failed());
					}
				} else {
					// 默认视图，只创建 SKILL.md
					// 先删除同名 skill 以避免重复
					await deleteSkill({ skill_list: [manualFormData.name] });

					const result = await createSkill({
						name: manualFormData.name,
						description: manualFormData.description,
						content: manualFormData.content,
					});

					if (result.success) {
						toast.success(m.skills_create_success());
						onCreate?.(currentView, { ...manualFormData });
						handleClose();
					} else {
						toast.error(m.skills_create_failed());
					}
				}
			} catch (error) {
				logger.error("Failed to create skill:", error);
				toast.error(m.skills_create_failed());
			} finally {
				isCreating = false;
			}
		} else if (currentView === "upload") {
			if (!uploadFormRef?.validate()) return;

			const { skillRootDir, formData } = uploadFormRef.getSkillData();

			isCreating = true;
			try {
				// Write changed files to temp directory
				await uploadFormRef.writeChangedFiles();

				// 先删除同名 skill 以避免重复
				await deleteSkill({ skill_list: [formData.name] });

				// Zip and upload
				const result = await updateSkill({
					name: formData.name,
					dirPath: skillRootDir,
				});

				if (result.success) {
					toast.success(m.skills_create_success());
					onCreate?.(currentView, formData);
					handleClose();
				} else {
					toast.error(m.skills_create_failed());
				}
			} catch (error) {
				logger.error("Failed to create skill from upload:", error);
				toast.error(m.skills_create_failed());
			} finally {
				isCreating = false;
			}
		} else if (currentView === "history") {
			if (!historyFormRef?.validate()) return;

			const selected = historyFormRef.getSelectedConversation();
			if (!selected) return;

			isCreating = true;
			try {
				const { sandboxId, sessionId } = selected;

				// 1. 根据 sessionId 查找 threadId
				const { isOK, threadId } =
					await window.electronAPI.codeAgentService.getThreadIdBySessionId(
						sandboxId,
						sessionId,
					);

				if (!isOK || !threadId) {
					toast.error(m.skills_history_thread_not_found());
					return;
				}

				// 2. 获取当前窗口 ID（如果是在 chat page 中使用，用于决定在哪个窗口创建新 tab）
				// window.windowId 在 shell view 中可用
				const currentWindowId = window.windowId || undefined;

				// 3. 导航到 thread（自动处理所有场景：激活已存在的 tab 或创建新 tab）
				const result = await window.electronAPI.windowService.navigateToThread(
					threadId,
					currentWindowId,
				);

				if (result.success) {
					// Trigger the summary message in the target thread
					setTimeout(() => {
						window.electronAPI.tabService.triggerCreateSkillSummary(threadId);
					}, 1000);

					handleClose();
				} else {
					toast.error(m.skills_history_navigate_failed());
				}
			} catch (error) {
				logger.error("Failed to navigate to history thread:", error);
				toast.error(m.skills_history_navigate_failed());
			} finally {
				isCreating = false;
			}
		} else if (currentView === "github") {
			if (!githubFormRef?.validate()) return;

			const githubUrl = githubFormRef.getGitHubUrl();

			isCreating = true;
			try {
				const result = await createSkillFromGitHub(githubUrl);

				if (result.success) {
					toast.success(m.skills_create_success());
					onCreate?.(currentView, { githubUrl });
					handleClose();
				} else {
					toast.error(m.skills_create_failed());
				}
			} catch (error) {
				logger.error("Failed to create skill from GitHub:", error);
				toast.error(m.skills_create_failed());
			} finally {
				isCreating = false;
			}
		} else {
			// TODO: Implement other creation methods
			onCreate?.(currentView as SkillCreateMethod, {});
			handleClose();
		}
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class=" rounded-2xl p-0 min-w-[600px]" showCloseButton={false}>
		{#if currentView === "select"}
			<!-- Selection View -->
			<div class="grid grid-cols-[1fr_auto_1fr] items-center border-b px-4 py-3">
				<div></div>
				<span class="text-foreground text-base font-semibold"
					>{m.skills_create_title()}</span
				>
				<div class="flex justify-end">
					<Button variant="ghost" size="icon" class="h-8 w-8" onclick={handleClose}>
						<X class="h-4 w-4" />
					</Button>
				</div>
			</div>

			<div class="px-6 py-6">
				<p class="text-muted-foreground mb-4 text-sm">{m.skills_create_select_method()}</p>

				<div class="grid grid-cols-2 gap-4">
					{#each createOptions as option (option.id)}
						<button
							type="button"
							class="flex flex-col items-center gap-2 rounded-xl border bg-transparent p-6 transition-colors hover:border-[#8B5CF6] hover:bg-[#F5F3FF] dark:hover:bg-violet-950/50"
							onclick={() => handleSelectOption(option.id)}
						>
							<div
								class="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-xl"
							>
								<option.icon class="h-6 w-6" />
							</div>
							<span class="text-foreground text-sm font-semibold"
								>{option.titleKey()}</span
							>
							<span class="text-muted-foreground text-xs">{option.descKey()}</span>
						</button>
					{/each}
				</div>
			</div>

			<div class="flex gap-3 border-t px-6 py-4">
				<Button variant="outline" class="flex-1" onclick={handleClose}>
					{m.text_button_cancel()}
				</Button>
				<Button
					class="flex-1 bg-violet-500 hover:bg-violet-600"
					onclick={handleConfirmSelect}
				>
					{m.text_button_confirm()}
				</Button>
			</div>
		{:else}
			<!-- Secondary View -->
			<div class="grid grid-cols-[1fr_auto_1fr] items-center border-b px-4 py-3">
				<div class="flex justify-start">
					<Button
						variant="ghost"
						class="text-muted-foreground flex items-center text-center text-[14px]"
						size="sm"
						onclick={handleBack}
					>
						<ChevronLeft class="h-4 w-4" />
						{m.skills_back()}
					</Button>
				</div>
				<span class="text-foreground text-base font-semibold"
					>{m.skills_create_title()}</span
				>
				<div class="flex justify-end">
					<Button variant="ghost" size="icon" class="h-8 w-8" onclick={handleClose}>
						<X class="h-4 w-4" />
					</Button>
				</div>
			</div>

			{#if currentView === "manual"}
				<!-- Manual Creation Form -->
				<SkillManualForm
					bind:formData={manualFormData}
					bind:this={manualFormRef}
					enableManualFileTree={true}
				/>
			{:else if currentView === "upload"}
				<!-- Upload ZIP Form -->
				<SkillUploadForm bind:this={uploadFormRef} />
			{:else if currentView === "history"}
				<!-- History Selection Form -->
				<SkillHistoryForm bind:this={historyFormRef} />
			{:else if currentView === "github"}
				<!-- GitHub Import Form -->
				<SkillGithubForm bind:this={githubFormRef} />
			{:else}
				<!-- Coming Soon Placeholder -->
				<div class="flex flex-col items-center justify-center px-6 py-12">
					<div
						class="bg-primary/10 text-primary mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
					>
						{#if currentOption}
							<currentOption.icon class="h-8 w-8" />
						{/if}
					</div>
					<p class="text-muted-foreground text-sm">{m.skills_create_coming_soon()}</p>
				</div>
			{/if}

			<div class="flex gap-3 border-t px-6 py-4">
				<Button
					variant="outline"
					class="flex-1"
					onclick={handleClose}
					disabled={isCreating}
				>
					{m.text_button_cancel()}
				</Button>
				<Button
					class="flex-1 bg-violet-500 hover:bg-violet-600"
					onclick={handleConfirmCreate}
					disabled={isCreating}
				>
					{isCreating ? m.skills_creating() : m.text_button_confirm()}
				</Button>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
