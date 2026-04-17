import { createLibrary, defineComponent } from "@openuidev/lang-core";
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

const AccordionDef = defineComponent({
	name: "Accordion",
	description: "A vertical list of expandable sections",
	props: AccordionSchema,
	component: null,
});
const AlertDef = defineComponent({
	name: "Alert",
	description: "An alert message container",
	props: AlertSchema,
	component: null,
});
const AspectRatioDef = defineComponent({
	name: "AspectRatio",
	description: "A container preserving a fixed aspect ratio",
	props: AspectRatioSchema,
	component: null,
});
const AvatarDef = defineComponent({
	name: "Avatar",
	description: "A user avatar with image and fallback",
	props: AvatarSchema,
	component: null,
});
const BadgeDef = defineComponent({
	name: "Badge",
	description: "A small status badge",
	props: BadgeSchema,
	component: null,
});
const BarChartDef = defineComponent({
	name: "BarChart",
	description: "A categorical comparison chart using vertical bars",
	props: BarChartSchema,
	component: null,
});
const ButtonDef = defineComponent({
	name: "Button",
	description: "A normal button",
	props: ButtonSchema,
	component: null,
});
const CardDef = defineComponent({
	name: "Card",
	description: "A general purpose content container",
	props: CardSchema,
	component: null,
});
const ChatPanelDef = defineComponent({
	name: "ChatPanel",
	description: "A chat-oriented panel container with optional header and nested content",
	props: ChatPanelSchema,
	component: null,
});
const CheckboxDef = defineComponent({
	name: "Checkbox",
	description: "A checkbox input",
	props: CheckboxSchema,
	component: null,
});
const CollapsibleDef = defineComponent({
	name: "Collapsible",
	description: "A disclosure section that can expand or collapse",
	props: CollapsibleSchema,
	component: null,
});
const DoughnutChartDef = defineComponent({
	name: "DoughnutChart",
	description: "A circular chart for share or composition data",
	props: DoughnutChartSchema,
	component: null,
});
const InputDef = defineComponent({
	name: "Input",
	description: "A text input field",
	props: InputSchema,
	component: null,
});
const LabelDef = defineComponent({
	name: "Label",
	description: "A label for form controls",
	props: LabelSchema,
	component: null,
});
const LineChartDef = defineComponent({
	name: "LineChart",
	description: "A line chart for trends over time",
	props: LineChartSchema,
	component: null,
});
const ProgressDef = defineComponent({
	name: "Progress",
	description: "A progress indicator",
	props: ProgressSchema,
	component: null,
});
const RadioGroupDef = defineComponent({
	name: "RadioGroup",
	description: "A single-choice radio group",
	props: RadioGroupSchema,
	component: null,
});
const ScrollAreaDef = defineComponent({
	name: "ScrollArea",
	description: "A scrollable content area",
	props: ScrollAreaSchema,
	component: null,
});
const SeparatorDef = defineComponent({
	name: "Separator",
	description: "A visual separator line",
	props: SeparatorSchema,
	component: null,
});
const SkeletonDef = defineComponent({
	name: "Skeleton",
	description: "A loading placeholder block",
	props: SkeletonSchema,
	component: null,
});
const SliderDef = defineComponent({
	name: "Slider",
	description: "A slider control for numeric values",
	props: SliderSchema,
	component: null,
});
const StackDef = defineComponent({
	name: "Stack",
	description: "A flexible stack layout for arranging child components",
	props: StackSchema,
	component: null,
});
const SwitchDef = defineComponent({
	name: "Switch",
	description: "A binary toggle switch",
	props: SwitchSchema,
	component: null,
});
const TableDef = defineComponent({
	name: "Table",
	description: "A simple data table",
	props: TableSchema,
	component: null,
});
const TabsDef = defineComponent({
	name: "Tabs",
	description: "Tabbed content sections",
	props: TabsSchema,
	component: null,
});
const TextDef = defineComponent({
	name: "Text",
	description: "A text block for displaying plain content",
	props: TextSchema,
	component: null,
});
const TextareaDef = defineComponent({
	name: "Textarea",
	description: "A multiline text input",
	props: TextareaSchema,
	component: null,
});
const ToggleDef = defineComponent({
	name: "Toggle",
	description: "A pressable toggle control",
	props: ToggleSchema,
	component: null,
});
const ToggleGroupDef = defineComponent({
	name: "ToggleGroup",
	description: "A grouped set of toggles",
	props: ToggleGroupSchema,
	component: null,
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
