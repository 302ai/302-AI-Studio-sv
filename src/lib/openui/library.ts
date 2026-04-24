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
	description:
		"A vertical list of expandable sections. Props: type ('single'|'multiple'), value (current open item), items (array of {value, title, content}). Example: Accordion({type: 'multiple', items: [{value: 'intro', title: 'Introduction', content: '...'}, {value: 'setup', title: 'Setup', content: '...'}]})",
	props: AccordionSchema,
	component: null,
});
const AlertDef = defineComponent({
	name: "Alert",
	description:
		"An alert message container. Props: variant ('default'|'destructive'), children (content). Use for important messages, warnings, or errors. Example: Alert({variant: 'destructive', children: 'Error message here'})",
	props: AlertSchema,
	component: null,
});
const AspectRatioDef = defineComponent({
	name: "AspectRatio",
	description:
		"A container preserving a fixed aspect ratio. Props: ratio (number, e.g., 16/9), children (content to scale). Example: AspectRatio({ratio: 16/9}, Image({src: '...'}))",
	props: AspectRatioSchema,
	component: null,
});
const AvatarDef = defineComponent({
	name: "Avatar",
	description:
		"A user avatar with image and fallback. Props: src (image URL), alt (image description), fallback (initials to show if image fails). Example: Avatar({src: 'https://...', alt: 'User photo', fallback: 'JD'})",
	props: AvatarSchema,
	component: null,
});
const BadgeDef = defineComponent({
	name: "Badge",
	description:
		"A small status badge. Props: variant ('default'|'secondary'|'destructive'|'outline'), text (string content), href (optional link). Use for labels, status indicators. Example: Badge({variant: 'secondary', text: 'New'})",
	props: BadgeSchema,
	component: null,
});
const BarChartDef = defineComponent({
	name: "BarChart",
	description:
		"A categorical comparison chart using vertical bars. Props: title, description (optional), labels (array), series (array of {label, values, color}), height, showLegend. Example: BarChart('Title', 'Desc', labels, series)",
	props: BarChartSchema,
	component: null,
});
const ButtonDef = defineComponent({
	name: "Button",
	description:
		"A clickable button. Props: variant ('default'|'destructive'|'outline'|'secondary'|'ghost'|'link'), size ('default'|'sm'|'lg'|'icon'), href (link URL), disabled, children (label). Example: Button({variant: 'default', size: 'lg', children: 'Click Me'})",
	props: ButtonSchema,
	component: null,
});
const CardDef = defineComponent({
	name: "Card",
	description:
		"A card container. Props: title, description (optional), children (optional), footer (optional). Example: Card('Title', 'Description', content, 'Footer')",
	props: CardSchema,
	component: null,
});
const ChatPanelDef = defineComponent({
	name: "ChatPanel",
	description:
		"Root panel container. Props: title, description (optional), class (optional), children (optional). Example: ChatPanel('Title', 'Description', class, children)",
	props: ChatPanelSchema,
	component: null,
});
const CheckboxDef = defineComponent({
	name: "Checkbox",
	description:
		"A checkbox input for binary choices. Props: checked, indeterminate, disabled, name, value, required. Example: Checkbox({checked: false, label: 'Accept terms'})",
	props: CheckboxSchema,
	component: null,
});
const CollapsibleDef = defineComponent({
	name: "Collapsible",
	description:
		"A disclosure section that can expand or collapse. Props: open (boolean), label (header text), content (body content). Example: Collapsible({open: false, label: 'Details', content: 'Hidden info...'})",
	props: CollapsibleSchema,
	component: null,
});
const DoughnutChartDef = defineComponent({
	name: "DoughnutChart",
	description:
		"A circular chart for share or composition data. Props: title, description (optional), items (array of {label, value, color}), height, showLegend. Example: DoughnutChart('Title', 'Desc', items)",
	props: DoughnutChartSchema,
	component: null,
});
const InputDef = defineComponent({
	name: "Input",
	description:
		"A text input field. Props: type ('text'|'email'|'password'|'number'|'search'|'url'|'tel'|'file'), value, placeholder, disabled, name, required. Example: Input({type: 'email', placeholder: 'Enter email', required: true})",
	props: InputSchema,
	component: null,
});
const LabelDef = defineComponent({
	name: "Label",
	description:
		"A label for form controls. Props: for (associated input id), children (label text). Links to form inputs for accessibility. Example: Label({for: 'email', children: 'Email Address'})",
	props: LabelSchema,
	component: null,
});
const LineChartDef = defineComponent({
	name: "LineChart",
	description:
		"A line chart for trends over time. Props: title, description (optional), labels (array), series (array of {label, values, color, fill}), height, showLegend. Example: LineChart('Title', 'Desc', labels, series)",
	props: LineChartSchema,
	component: null,
});
const ProgressDef = defineComponent({
	name: "Progress",
	description:
		"A progress indicator showing completion percentage. Props: value (current number), max (total, default 100). Example: Progress({value: 65, max: 100})",
	props: ProgressSchema,
	component: null,
});
const RadioGroupDef = defineComponent({
	name: "RadioGroup",
	description:
		"A single-choice radio group. Props: value (selected option), name, orientation ('vertical'|'horizontal'), options (array of {value, label, description?, disabled?}). Example: RadioGroup({name: 'plan', orientation: 'vertical', options: [{value: 'basic', label: 'Basic'}, {value: 'pro', label: 'Pro'}]})",
	props: RadioGroupSchema,
	component: null,
});
const ScrollAreaDef = defineComponent({
	name: "ScrollArea",
	description:
		"A scrollable content area. Props: orientation ('vertical'|'horizontal'|'both'), children (scrollable content). Example: ScrollArea({orientation: 'vertical', children: LongContent()})",
	props: ScrollAreaSchema,
	component: null,
});
const SeparatorDef = defineComponent({
	name: "Separator",
	description:
		"A visual separator line. Props: orientation ('horizontal'|'vertical'), decorative (optional). Example: Separator('horizontal', true)",
	props: SeparatorSchema,
	component: null,
});
const SkeletonDef = defineComponent({
	name: "Skeleton",
	description:
		"A loading placeholder block. Props: class (custom styling). Shows animated placeholder while content loads. Example: Skeleton({class: 'w-32 h-4'})",
	props: SkeletonSchema,
	component: null,
});
const SliderDef = defineComponent({
	name: "Slider",
	description:
		"A slider control for numeric values. Props: value (array of numbers), min, max, step, type ('single'|'multiple'), orientation, disabled. Example: Slider({value: [50], min: 0, max: 100, step: 1})",
	props: SliderSchema,
	component: null,
});
const StackDef = defineComponent({
	name: "Stack",
	description:
		"A flexible stack layout. Props: children (array), direction ('vertical'|'horizontal'), gap ('s'|'m'|'l'). Example: Stack(children, 'horizontal', 'm')",
	props: StackSchema,
	component: null,
});
const SwitchDef = defineComponent({
	name: "Switch",
	description:
		"A binary toggle switch. Props: checked, disabled, name, value, required. Example: Switch({checked: false, label: 'Enable notifications'})",
	props: SwitchSchema,
	component: null,
});
const TableDef = defineComponent({
	name: "Table",
	description:
		'A simple data table. First argument is columns (array of header strings), second argument is rows (2D array of data). Example: Table(["Name", "Age"], [["Alice", 25], ["Bob", 30]])',
	props: TableSchema,
	component: null,
});
const TabsDef = defineComponent({
	name: "Tabs",
	description:
		"Tabbed content sections. Props: value (active tab), items (array of {value, label, content?}). Clicking tab switches displayed content. Example: Tabs({value: 'overview', items: [{value: 'overview', label: 'Overview', content: '...'}, {value: 'details', label: 'Details', content: '...'}]})",
	props: TabsSchema,
	component: null,
});
const TextDef = defineComponent({
	name: "Text",
	description:
		"A text block for displaying plain content. Props: value (text string), variant ('default'|'muted'|'title'), class. Use for paragraph text, descriptions. Example: Text({value: 'This is a description', variant: 'muted'})",
	props: TextSchema,
	component: null,
});
const TextareaDef = defineComponent({
	name: "Textarea",
	description:
		"A multiline text input. Props: value, placeholder, disabled, name, rows, required. Example: Textarea({placeholder: 'Enter description', rows: 4})",
	props: TextareaSchema,
	component: null,
});
const ToggleDef = defineComponent({
	name: "Toggle",
	description:
		"A pressable toggle control (button-style). Props: variant ('default'|'outline'), size ('default'|'sm'|'lg'), pressed (boolean), disabled, children (label). Example: Toggle({variant: 'outline', size: 'default', children: 'Bold'})",
	props: ToggleSchema,
	component: null,
});
const ToggleGroupDef = defineComponent({
	name: "ToggleGroup",
	description:
		"A grouped set of toggles. Props: type ('single'|'multiple'), value, variant ('default'|'outline'), size, items (array of {value, label, disabled?}). Example: ToggleGroup({type: 'multiple', size: 'default', items: [{value: 'a', label: 'A'}, {value: 'b', label: 'B'}]})",
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
