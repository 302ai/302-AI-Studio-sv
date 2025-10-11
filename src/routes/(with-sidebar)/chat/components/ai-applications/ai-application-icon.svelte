<script lang="ts" module>
	interface Props {
		toolId: number;
		class?: string;
	}
</script>

<script lang="ts">
	import ai3DModelingIcon from "$lib/assets/icons/ai-application/AI-3D-Modeling.svg";
	import aiAcademicPaperSearchIcon from "$lib/assets/icons/ai-application/AI-Academic-Paper-Search.svg";
	import aiAnswerMachineIcon from "$lib/assets/icons/ai-application/AI-Answer-Machine.svg";
	import aiAvatarProductionIcon from "$lib/assets/icons/ai-application/AI-Avatar-Production.svg";
	import aiCardGenerationIcon from "$lib/assets/icons/ai-application/AI-Card-Generation.svg";
	import aiChangeClothesIcon from "$lib/assets/icons/ai-application/AI-Change-Clothes.svg";
	import aiCopywritingAssistantIcon from "$lib/assets/icons/ai-application/AI-Copywriting-Assistant.svg";
	import aiDeeplyTranslationIcon from "$lib/assets/icons/ai-application/AI-Deeply-Translation.svg";
	import aiDocumentEditorIcon from "$lib/assets/icons/ai-application/AI-Document-Editor.svg";
	import aiDrawingBoardIcon from "$lib/assets/icons/ai-application/AI-Drawing-Board.svg";
	import aiDrawingPromptWordExpertIcon from "$lib/assets/icons/ai-application/AI-Drawing-Prompt-Word-Expert.svg";
	import aiEcommerceCopywritingAssistantIcon from "$lib/assets/icons/ai-application/AI-E-commerce-Copywriting-Assistant.svg";
	import aiEcommerceSceneImageGenerationIcon from "$lib/assets/icons/ai-application/AI-E-commerce-Scene-Image-Generation.svg";
	import aiExcelIcon from "$lib/assets/icons/ai-application/AI-Excel.svg";
	import aiFactsProofIcon from "$lib/assets/icons/ai-application/AI-Facts-Proof.svg";
	import aiFinancialInformationAssistantIcon from "$lib/assets/icons/ai-application/AI-Financial-Information-Assistant.svg";
	import aiImageCreativeStationIcon from "$lib/assets/icons/ai-application/AI-Image-Creative-Station.svg";
	import aiImageToolboxIcon from "$lib/assets/icons/ai-application/AI-Image-Toolbox.svg";
	import aiLoraCreationStationIcon from "$lib/assets/icons/ai-application/AI-Lora-Creation-Station.svg";
	import aiModelJudgeIcon from "$lib/assets/icons/ai-application/AI-Model-Judge.svg";
	import aiMusicMakerIcon from "$lib/assets/icons/ai-application/AI-Music-Maker.svg";
	import aiNovelWritingIcon from "$lib/assets/icons/ai-application/AI-Novel-Writing.svg";
	import aiOldPhotoRestorationIcon from "$lib/assets/icons/ai-application/AI-Old-Photo-Restoration.svg";
	import aiPaperWritingIcon from "$lib/assets/icons/ai-application/AI-Paper-Writing.svg";
	import aiPatentSearchIcon from "$lib/assets/icons/ai-application/AI-Patent-Search.svg";
	import aiPhotoTranslationIcon from "$lib/assets/icons/ai-application/AI-Photo-Translation.svg";
	import aiPodcastProductionIcon from "$lib/assets/icons/ai-application/AI-Podcast-Production.svg";
	import aiPPTProductionIcon from "$lib/assets/icons/ai-application/AI-PPT-Production.svg";
	import {
		default as aiPromptExpert2Icon,
		default as aiPromptExpertIcon,
	} from "$lib/assets/icons/ai-application/AI-Prompt-Expert.svg";
	import aiRedEnvelopeCoverGenerationIcon from "$lib/assets/icons/ai-application/AI-Red-Envelope-Cover-Generation.svg";
	import aiResearchMasterIcon from "$lib/assets/icons/ai-application/AI-Research-Master.svg";
	import aiResumeCreationIcon from "$lib/assets/icons/ai-application/AI-Resume-Creation.svg";
	import aiSearchMaster3Icon from "$lib/assets/icons/ai-application/AI-Search-Master-3.svg";
	import aiSpeechArenaIcon from "$lib/assets/icons/ai-application/AI-Speech-Arena.svg";
	import aiSpeechCallIcon from "$lib/assets/icons/ai-application/AI-Speech-Call.svg";
	import aiSpeechGeneratorIcon from "$lib/assets/icons/ai-application/AI-Speech-Generator.svg";
	import aiSVGProductionIcon from "$lib/assets/icons/ai-application/AI-SVG-Production.svg";
	import aiTalkingPhotoIcon from "$lib/assets/icons/ai-application/AI-Talking-Photo.svg";
	import aiTranslateMasterIcon from "$lib/assets/icons/ai-application/AI-Translate-Master.svg";
	import aiVideoCreationStationIcon from "$lib/assets/icons/ai-application/AI-Video-Creation-Station.svg";
	import aiVideoGeneratorIcon from "$lib/assets/icons/ai-application/AI-Video-Generator.svg";
	import aiVideoSummaryIcon from "$lib/assets/icons/ai-application/AI-Video-Summary.svg";
	import aiVideoTranslationIcon from "$lib/assets/icons/ai-application/AI-Video-Translation.svg";
	import aiWebpageGenerator2Icon from "$lib/assets/icons/ai-application/AI-Webpage-Generator-2.svg";
	import aiWebpageGeneratorIcon from "$lib/assets/icons/ai-application/AI-Webpage-Generator.svg";
	import aiWebpageSummaryIcon from "$lib/assets/icons/ai-application/AI-Webpage-Summary.svg";
	import codeArenaIcon from "$lib/assets/icons/ai-application/Code-Arena.svg";
	import comfyUIToolboxIcon from "$lib/assets/icons/ai-application/ComfyUI-Toolbox.svg";
	import DeployWebPagesByOneclickIcon from "$lib/assets/icons/ai-application/Deploy-Web-Pages-By-Oneclick.svg";
	import drawingRobotIcon from "$lib/assets/icons/ai-application/Drawing-Robot.svg";
	import idPhotoProductionIcon from "$lib/assets/icons/ai-application/ID-Photo-Production.svg";
	import aiImageArenaIcon from "$lib/assets/icons/ai-application/Image-Arena.svg";
	import modelArenaIcon from "$lib/assets/icons/ai-application/Model-Arena.svg";
	import pdfComprehensiveToolboxIcon from "$lib/assets/icons/ai-application/PDF-Comprehensive-Toolbox.svg";
	import videoArenaIcon from "$lib/assets/icons/ai-application/Video-Arena.svg";
	import WebDataExtractionToolIcon from "$lib/assets/icons/ai-application/Web-Data-Extraction-Tool.svg";
	import { cn } from "$lib/utils";
	import { LayoutGrid } from "@lucide/svelte";

	let { toolId, class: className }: Props = $props();

	const iconMap: Record<string, string> = {
		// * Work Efficiency
		7: modelArenaIcon,
		21: aiCopywritingAssistantIcon,
		25: aiEcommerceCopywritingAssistantIcon,
		28: aiDocumentEditorIcon,
		30: aiPPTProductionIcon,
		43: aiWebpageSummaryIcon,
		45: aiDrawingBoardIcon,
		48: aiFinancialInformationAssistantIcon,
		49: aiExcelIcon,
		51: aiResumeCreationIcon,
		75: aiNovelWritingIcon,

		// * Academic Related
		12: aiAcademicPaperSearchIcon,
		15: pdfComprehensiveToolboxIcon,
		18: aiPatentSearchIcon,
		23: aiPaperWritingIcon,
		56: aiAnswerMachineIcon,
		46: aiAvatarProductionIcon,

		// * Information Processing
		4: aiResearchMasterIcon,
		5: aiTranslateMasterIcon,
		14: aiPromptExpertIcon,
		17: aiSearchMaster3Icon,
		57: WebDataExtractionToolIcon,
		63: aiPromptExpert2Icon,
		66: aiFactsProofIcon,
		70: DeployWebPagesByOneclickIcon,
		72: aiCardGenerationIcon,
		74: aiModelJudgeIcon,

		// * Image Processing
		"-1": drawingRobotIcon,
		11: aiOldPhotoRestorationIcon,
		13: aiEcommerceSceneImageGenerationIcon,
		19: aiImageToolboxIcon,
		39: aiPhotoTranslationIcon,
		42: idPhotoProductionIcon,
		47: aiTalkingPhotoIcon,
		54: aiRedEnvelopeCoverGenerationIcon,
		55: aiChangeClothesIcon,
		58: aiSVGProductionIcon,
		59: aiImageArenaIcon,
		60: ai3DModelingIcon,
		65: aiLoraCreationStationIcon,
		69: comfyUIToolboxIcon,
		71: aiDrawingPromptWordExpertIcon,
		73: aiImageCreativeStationIcon,

		// * Audio Related
		24: aiSpeechGeneratorIcon,
		38: aiMusicMakerIcon,
		41: aiPodcastProductionIcon,
		44: aiSpeechCallIcon,
		76: aiSpeechArenaIcon,

		// * Video Related
		10: aiVideoCreationStationIcon,
		16: aiVideoGeneratorIcon,
		20: aiVideoSummaryIcon,
		27: aiVideoTranslationIcon,
		53: aiDeeplyTranslationIcon,
		68: videoArenaIcon,

		// * Code Related
		8: aiWebpageGeneratorIcon,
		40: aiWebpageGenerator2Icon,
		61: codeArenaIcon,
	};

	let iconUrl = $derived(iconMap[toolId]);
</script>

{#if iconUrl}
	<img src={iconUrl} alt="AI Application Icon" class={cn("h-9 w-9 rounded-lg", className)} />
{:else}
	<div class={cn("flex h-9 w-9 items-center justify-center rounded-lg", className)}>
		<LayoutGrid class="h-5 w-5" />
	</div>
{/if}
