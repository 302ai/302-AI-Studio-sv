import { z } from "zod";

export const ChatPanelSchema = z.object({
	title: z.string().optional().describe("Optional panel title"),
	description: z.string().optional().describe("Optional helper text below the title"),
	class: z.string().optional().describe("Additional classes for the panel container"),
	children: z.any().optional().describe("Nested child components to render inside the panel"),
});

export const ButtonSchema = z.object({
	class: z.string().optional().describe("Additional classes to add to the button"),
	variant: z
		.enum(["default", "destructive", "outline", "secondary", "ghost", "link"])
		.optional()
		.describe("The variant of the button to use"),
	size: z
		.enum(["default", "sm", "lg", "icon", "icon-sm", "icon-lg"])
		.optional()
		.describe("The size of the button to use"),
	href: z.string().optional().describe("The href of the button, if it's a link"),
	type: z.enum(["button", "submit", "reset"]).optional().describe("The type of the button"),
	disabled: z.boolean().optional().describe("Whether the button is disabled"),
	children: z.any().optional().describe("Nested child components rendered inside the button"),
});

export const InputSchema = z.object({
	class: z.string().optional(),
	type: z
		.enum(["text", "email", "password", "number", "search", "url", "tel", "file"])
		.optional(),
	value: z.string().optional(),
	placeholder: z.string().optional(),
	disabled: z.boolean().optional(),
	name: z.string().optional(),
	required: z.boolean().optional(),
});

export const TextareaSchema = z.object({
	class: z.string().optional(),
	value: z.string().optional(),
	placeholder: z.string().optional(),
	disabled: z.boolean().optional(),
	name: z.string().optional(),
	rows: z.number().optional(),
	required: z.boolean().optional(),
});

export const CheckboxSchema = z.object({
	class: z.string().optional(),
	checked: z.boolean().optional(),
	indeterminate: z.boolean().optional(),
	disabled: z.boolean().optional(),
	required: z.boolean().optional(),
	name: z.string().optional(),
	value: z.string().optional(),
});

export const SwitchSchema = z.object({
	class: z.string().optional(),
	checked: z.boolean().optional(),
	disabled: z.boolean().optional(),
	required: z.boolean().optional(),
	name: z.string().optional(),
	value: z.string().optional(),
});

export const SeparatorSchema = z.object({
	class: z.string().optional(),
	orientation: z.enum(["horizontal", "vertical"]).optional(),
	decorative: z.boolean().optional(),
});

export const ProgressSchema = z.object({
	class: z.string().optional(),
	max: z.number().optional(),
	value: z.number().optional(),
});

export const SkeletonSchema = z.object({
	class: z.string().optional(),
});

export const AspectRatioSchema = z.object({
	ratio: z.number().optional(),
	children: z.any().optional(),
});

export const BadgeSchema = z.object({
	class: z.string().optional(),
	variant: z.enum(["default", "secondary", "destructive", "outline"]).optional(),
	href: z.string().optional(),
	text: z.string().optional(),
	children: z.any().optional(),
});

export const StackSchema = z.object({
	children: z.any().optional(),
	direction: z.enum(["vertical", "horizontal"]).optional(),
	gap: z.enum(["s", "m", "l"]).optional(),
	class: z.string().optional(),
});

export const TextSchema = z.object({
	value: z.string().optional(),
	class: z.string().optional(),
	variant: z.enum(["default", "muted", "title"]).optional(),
});

export const AlertSchema = z.object({
	class: z.string().optional(),
	variant: z.enum(["default", "destructive"]).optional(),
	children: z.any().optional(),
});

export const LabelSchema = z.object({
	class: z.string().optional(),
	for: z.string().optional(),
	children: z.any().optional(),
});

export const CardSchema = z.object({
	class: z.string().optional(),
	title: z.string().optional(),
	description: z.string().optional(),
	children: z.any().optional(),
	footer: z.string().optional(),
});

export const RadioGroupSchema = z.object({
	class: z.string().optional(),
	value: z.string().optional(),
	name: z.string().optional(),
	disabled: z.boolean().optional(),
	orientation: z.enum(["vertical", "horizontal"]).optional(),
	options: z
		.array(
			z.object({
				value: z.string(),
				label: z.string(),
				description: z.string().optional(),
				disabled: z.boolean().optional(),
			}),
		)
		.optional(),
});

export const TabsSchema = z.object({
	class: z.string().optional(),
	value: z.string().optional(),
	items: z
		.array(
			z.object({
				value: z.string(),
				label: z.string(),
				content: z.string().optional(),
			}),
		)
		.optional(),
});

export const SliderSchema = z.object({
	class: z.string().optional(),
	value: z.array(z.number()).optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	step: z.number().optional(),
	disabled: z.boolean().optional(),
	orientation: z.enum(["horizontal", "vertical"]).optional(),
	type: z.enum(["single", "multiple"]).optional(),
});

export const ToggleSchema = z.object({
	class: z.string().optional(),
	pressed: z.boolean().optional(),
	disabled: z.boolean().optional(),
	variant: z.enum(["default", "outline"]).optional(),
	size: z.enum(["default", "sm", "lg"]).optional(),
	children: z.any().optional(),
});

export const ScrollAreaSchema = z.object({
	class: z.string().optional(),
	orientation: z.enum(["vertical", "horizontal", "both"]).optional(),
	children: z.any().optional(),
});

export const AvatarSchema = z.object({
	class: z.string().optional(),
	src: z.string().optional(),
	alt: z.string().optional(),
	fallback: z.string().optional(),
});

export const AccordionSchema = z.object({
	class: z.string().optional(),
	type: z.enum(["single", "multiple"]).optional(),
	value: z.union([z.string(), z.array(z.string())]).optional(),
	items: z
		.array(
			z.object({
				value: z.string(),
				title: z.string(),
				content: z.string().optional(),
			}),
		)
		.optional(),
});

export const CollapsibleSchema = z.object({
	open: z.boolean().optional(),
	label: z.string().optional(),
	content: z.string().optional(),
	class: z.string().optional(),
});

export const TableSchema = z.object({
	class: z.string().optional(),
	columns: z.array(z.string()).optional(),
	rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).optional(),
});

export const ToggleGroupSchema = z.object({
	class: z.string().optional(),
	type: z.enum(["single", "multiple"]).optional(),
	value: z.union([z.string(), z.array(z.string())]).optional(),
	variant: z.enum(["default", "outline"]).optional(),
	size: z.enum(["default", "sm", "lg"]).optional(),
	items: z
		.array(
			z.object({
				value: z.string(),
				label: z.string(),
				disabled: z.boolean().optional(),
			}),
		)
		.optional(),
});

export const BarChartSchema = z.object({
	title: z.string().optional(),
	description: z.string().optional(),
	labels: z.array(z.string()).optional(),
	series: z
		.array(
			z.object({
				label: z.string().optional(),
				values: z.array(z.number()),
				color: z.string().optional(),
			}),
		)
		.optional(),
	height: z.number().optional(),
	showLegend: z.boolean().optional(),
	class: z.string().optional(),
});

export const LineChartSchema = z.object({
	title: z.string().optional(),
	description: z.string().optional(),
	labels: z.array(z.string()).optional(),
	series: z
		.array(
			z.object({
				label: z.string().optional(),
				values: z.array(z.number()),
				color: z.string().optional(),
				fill: z.boolean().optional(),
			}),
		)
		.optional(),
	height: z.number().optional(),
	showLegend: z.boolean().optional(),
	class: z.string().optional(),
});

export const DoughnutChartSchema = z.object({
	title: z.string().optional(),
	description: z.string().optional(),
	items: z
		.array(
			z.object({
				label: z.string(),
				value: z.number(),
				color: z.string().optional(),
			}),
		)
		.optional(),
	height: z.number().optional(),
	showLegend: z.boolean().optional(),
	class: z.string().optional(),
});

export const componentConfigs = [
	{
		name: "Alert",
		description: "An alert message container",
		props: AlertSchema,
	},
	{
		name: "AspectRatio",
		description: "A container preserving a fixed aspect ratio",
		props: AspectRatioSchema,
	},
	{
		name: "Badge",
		description: "A small status badge",
		props: BadgeSchema,
	},
	{
		name: "Button",
		description: "A normal button",
		props: ButtonSchema,
	},
	{
		name: "Card",
		description: "A general purpose content container",
		props: CardSchema,
	},
	{
		name: "ChatPanel",
		description: "A chat-oriented panel container with optional header and nested content",
		props: ChatPanelSchema,
	},
	{
		name: "Checkbox",
		description: "A checkbox input",
		props: CheckboxSchema,
	},
	{
		name: "Input",
		description: "A text input field",
		props: InputSchema,
	},
	{
		name: "Label",
		description: "A label for form controls",
		props: LabelSchema,
	},
	{
		name: "RadioGroup",
		description: "A single-choice radio group",
		props: RadioGroupSchema,
	},
	{
		name: "Progress",
		description: "A progress indicator",
		props: ProgressSchema,
	},
	{
		name: "ScrollArea",
		description: "A scrollable content area",
		props: ScrollAreaSchema,
	},
	{
		name: "Separator",
		description: "A visual separator line",
		props: SeparatorSchema,
	},
	{
		name: "Slider",
		description: "A slider control for numeric values",
		props: SliderSchema,
	},
	{
		name: "Stack",
		description: "A flexible stack layout for arranging child components",
		props: StackSchema,
	},
	{
		name: "Skeleton",
		description: "A loading placeholder block",
		props: SkeletonSchema,
	},
	{
		name: "Switch",
		description: "A binary toggle switch",
		props: SwitchSchema,
	},
	{
		name: "Tabs",
		description: "Tabbed content sections",
		props: TabsSchema,
	},
	{
		name: "Text",
		description: "A text block for displaying plain content",
		props: TextSchema,
	},
	{
		name: "Textarea",
		description: "A multiline text input",
		props: TextareaSchema,
	},
	{
		name: "Toggle",
		description: "A pressable toggle control",
		props: ToggleSchema,
	},
	{
		name: "ToggleGroup",
		description: "A grouped set of toggles",
		props: ToggleGroupSchema,
	},
	{
		name: "Avatar",
		description: "A user avatar with image and fallback",
		props: AvatarSchema,
	},
	{
		name: "Accordion",
		description: "A vertical list of expandable sections",
		props: AccordionSchema,
	},
	{
		name: "Collapsible",
		description: "A disclosure section that can expand or collapse",
		props: CollapsibleSchema,
	},
	{
		name: "Table",
		description: "A simple data table",
		props: TableSchema,
	},
] as const;
