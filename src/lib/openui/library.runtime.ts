import { createLibrary, defineComponent } from "@openuidev/svelte-lang";
import AccordionRenderer from "./AccordionRenderer.svelte";
import AlertRenderer from "./AlertRenderer.svelte";
import AspectRatioRenderer from "./AspectRatioRenderer.svelte";
import AvatarRenderer from "./AvatarRenderer.svelte";
import BadgeRenderer from "./BadgeRenderer.svelte";
import BarChartRenderer from "./BarChartRenderer.svelte";
import ButtonRenderer from "./ButtonRenderer.svelte";
import CardRenderer from "./CardRenderer.svelte";
import ChatPanelRenderer from "./ChatPanelRenderer.svelte";
import CheckboxRenderer from "./CheckboxRenderer.svelte";
import CollapsibleRenderer from "./CollapsibleRenderer.svelte";
import DoughnutChartRenderer from "./DoughnutChartRenderer.svelte";
import {
	AccordionSchema,
	AlertSchema,
	AspectRatioSchema,
	AvatarSchema,
	BadgeSchema,
	BarChartSchema,
	ButtonSchema,
	CardSchema,
	ChatPanelSchema,
	CheckboxSchema,
	CollapsibleSchema,
	DoughnutChartSchema,
	InputSchema,
	LabelSchema,
	LineChartSchema,
	ProgressSchema,
	RadioGroupSchema,
	ScrollAreaSchema,
	SeparatorSchema,
	SkeletonSchema,
	SliderSchema,
	StackSchema,
	SwitchSchema,
	TableSchema,
	TabsSchema,
	TextSchema,
	TextareaSchema,
	ToggleGroupSchema,
	ToggleSchema,
} from "./component-schemas";
import InputRenderer from "./InputRenderer.svelte";
import LabelRenderer from "./LabelRenderer.svelte";
import LineChartRenderer from "./LineChartRenderer.svelte";
import ProgressRenderer from "./ProgressRenderer.svelte";
import RadioGroupRenderer from "./RadioGroupRenderer.svelte";
import ScrollAreaRenderer from "./ScrollAreaRenderer.svelte";
import SeparatorRenderer from "./SeparatorRenderer.svelte";
import SkeletonRenderer from "./SkeletonRenderer.svelte";
import SliderRenderer from "./SliderRenderer.svelte";
import StackRenderer from "./StackRenderer.svelte";
import SwitchRenderer from "./SwitchRenderer.svelte";
import TableRenderer from "./TableRenderer.svelte";
import TabsRenderer from "./TabsRenderer.svelte";
import TextRenderer from "./TextRenderer.svelte";
import TextareaRenderer from "./TextareaRenderer.svelte";
import ToggleGroupRenderer from "./ToggleGroupRenderer.svelte";
import ToggleRenderer from "./ToggleRenderer.svelte";

const AccordionDef = defineComponent({
	name: "Accordion",
	description: "A vertical list of expandable sections",
	props: AccordionSchema,
	component: AccordionRenderer,
});
const AlertDef = defineComponent({
	name: "Alert",
	description: "An alert message container",
	props: AlertSchema,
	component: AlertRenderer,
});
const AspectRatioDef = defineComponent({
	name: "AspectRatio",
	description: "A container preserving a fixed aspect ratio",
	props: AspectRatioSchema,
	component: AspectRatioRenderer,
});
const AvatarDef = defineComponent({
	name: "Avatar",
	description: "A user avatar with image and fallback",
	props: AvatarSchema,
	component: AvatarRenderer,
});
const BadgeDef = defineComponent({
	name: "Badge",
	description: "A small status badge",
	props: BadgeSchema,
	component: BadgeRenderer,
});
const BarChartDef = defineComponent({
	name: "BarChart",
	description: "A categorical comparison chart using vertical bars",
	props: BarChartSchema,
	component: BarChartRenderer,
});
const ButtonDef = defineComponent({
	name: "Button",
	description: "A normal button",
	props: ButtonSchema,
	component: ButtonRenderer,
});
const CardDef = defineComponent({
	name: "Card",
	description: "A general purpose content container",
	props: CardSchema,
	component: CardRenderer,
});
const ChatPanelDef = defineComponent({
	name: "ChatPanel",
	description: "A chat-oriented panel container with optional header and nested content",
	props: ChatPanelSchema,
	component: ChatPanelRenderer,
});
const CheckboxDef = defineComponent({
	name: "Checkbox",
	description: "A checkbox input",
	props: CheckboxSchema,
	component: CheckboxRenderer,
});
const CollapsibleDef = defineComponent({
	name: "Collapsible",
	description: "A disclosure section that can expand or collapse",
	props: CollapsibleSchema,
	component: CollapsibleRenderer,
});
const DoughnutChartDef = defineComponent({
	name: "DoughnutChart",
	description: "A circular chart for share or composition data",
	props: DoughnutChartSchema,
	component: DoughnutChartRenderer,
});
const InputDef = defineComponent({
	name: "Input",
	description: "A text input field",
	props: InputSchema,
	component: InputRenderer,
});
const LabelDef = defineComponent({
	name: "Label",
	description: "A label for form controls",
	props: LabelSchema,
	component: LabelRenderer,
});
const LineChartDef = defineComponent({
	name: "LineChart",
	description: "A line chart for trends over time",
	props: LineChartSchema,
	component: LineChartRenderer,
});
const ProgressDef = defineComponent({
	name: "Progress",
	description: "A progress indicator",
	props: ProgressSchema,
	component: ProgressRenderer,
});
const RadioGroupDef = defineComponent({
	name: "RadioGroup",
	description: "A single-choice radio group",
	props: RadioGroupSchema,
	component: RadioGroupRenderer,
});
const ScrollAreaDef = defineComponent({
	name: "ScrollArea",
	description: "A scrollable content area",
	props: ScrollAreaSchema,
	component: ScrollAreaRenderer,
});
const SeparatorDef = defineComponent({
	name: "Separator",
	description: "A visual separator line",
	props: SeparatorSchema,
	component: SeparatorRenderer,
});
const SkeletonDef = defineComponent({
	name: "Skeleton",
	description: "A loading placeholder block",
	props: SkeletonSchema,
	component: SkeletonRenderer,
});
const SliderDef = defineComponent({
	name: "Slider",
	description: "A slider control for numeric values",
	props: SliderSchema,
	component: SliderRenderer,
});
const StackDef = defineComponent({
	name: "Stack",
	description: "A flexible stack layout for arranging child components",
	props: StackSchema,
	component: StackRenderer,
});
const SwitchDef = defineComponent({
	name: "Switch",
	description: "A binary toggle switch",
	props: SwitchSchema,
	component: SwitchRenderer,
});
const TableDef = defineComponent({
	name: "Table",
	description: "A simple data table",
	props: TableSchema,
	component: TableRenderer,
});
const TabsDef = defineComponent({
	name: "Tabs",
	description: "Tabbed content sections",
	props: TabsSchema,
	component: TabsRenderer,
});
const TextDef = defineComponent({
	name: "Text",
	description: "A text block for displaying plain content",
	props: TextSchema,
	component: TextRenderer,
});
const TextareaDef = defineComponent({
	name: "Textarea",
	description: "A multiline text input",
	props: TextareaSchema,
	component: TextareaRenderer,
});
const ToggleDef = defineComponent({
	name: "Toggle",
	description: "A pressable toggle control",
	props: ToggleSchema,
	component: ToggleRenderer,
});
const ToggleGroupDef = defineComponent({
	name: "ToggleGroup",
	description: "A grouped set of toggles",
	props: ToggleGroupSchema,
	component: ToggleGroupRenderer,
});

export const components = [
	AccordionDef,
	AlertDef,
	AspectRatioDef,
	AvatarDef,
	BadgeDef,
	BarChartDef,
	ButtonDef,
	CardDef,
	ChatPanelDef,
	CheckboxDef,
	CollapsibleDef,
	DoughnutChartDef,
	InputDef,
	LabelDef,
	LineChartDef,
	ProgressDef,
	RadioGroupDef,
	ScrollAreaDef,
	SeparatorDef,
	SkeletonDef,
	SliderDef,
	StackDef,
	SwitchDef,
	TableDef,
	TabsDef,
	TextDef,
	TextareaDef,
	ToggleDef,
	ToggleGroupDef,
];

const library = createLibrary({
	components,
	root: "ChatPanel",
});

export default library;
