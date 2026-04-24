import { z } from "zod";

export const ChatPanelSchema = z.object({
	title: z.string().describe("Panel title"),
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
	orientation: z.enum(["horizontal", "vertical"]),
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
	children: z.any(),
	direction: z.enum(["vertical", "horizontal"]),
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
	title: z.string(),
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
	columns: z.array(z.string()),
	rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))),
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
	title: z.string(),
	description: z.string().optional(),
	labels: z.array(z.string()),
	series: z.array(
		z.object({
			label: z.string().optional(),
			values: z.array(z.number()),
			color: z.string().optional(),
		}),
	),
	height: z.number().optional(),
	showLegend: z.boolean().optional(),
	class: z.string().optional(),
});

export const LineChartSchema = z.object({
	title: z.string(),
	description: z.string().optional(),
	labels: z.array(z.string()),
	series: z.array(
		z.object({
			label: z.string().optional(),
			values: z.array(z.number()),
			color: z.string().optional(),
			fill: z.boolean().optional(),
		}),
	),
	height: z.number().optional(),
	showLegend: z.boolean().optional(),
	class: z.string().optional(),
});

export const DoughnutChartSchema = z.object({
	title: z.string(),
	description: z.string().optional(),
	items: z.array(
		z.object({
			label: z.string(),
			value: z.number(),
			color: z.string().optional(),
		}),
	),
	height: z.number().optional(),
	showLegend: z.boolean().optional(),
	class: z.string().optional(),
});

export const componentConfigs = [
	{
		name: "Alert",
		description:
			"An alert message container. Props: variant ('default'|'destructive'), children (content). Use for important messages, warnings, or errors.",
		props: AlertSchema,
	},
	{
		name: "AspectRatio",
		description:
			"A container preserving a fixed aspect ratio. Props: ratio (number, e.g., 16/9), children (content to scale).",
		props: AspectRatioSchema,
	},
	{
		name: "Badge",
		description:
			"A small status badge. Props: variant ('default'|'secondary'|'destructive'|'outline'), text (string content), href (optional link).",
		props: BadgeSchema,
	},
	{
		name: "Button",
		description:
			"A clickable button. Props: variant ('default'|'destructive'|'outline'|'secondary'|'ghost'|'link'), size ('default'|'sm'|'lg'|'icon'), href, disabled, children.",
		props: ButtonSchema,
	},
	{
		name: "Card",
		description:
			"A card container. Props: title, description (optional), children (optional), footer (optional). Example: Card('Title', 'Desc', content, 'Footer')",
		props: CardSchema,
	},
	{
		name: "ChatPanel",
		description:
			"Root panel container. Props: title, description (optional), class (optional), children (optional). Example: ChatPanel('Title', 'Desc', class, children)",
		props: ChatPanelSchema,
	},
	{
		name: "Checkbox",
		description:
			"A checkbox input for binary choices. Props: checked, indeterminate, disabled, name, value, required.",
		props: CheckboxSchema,
	},
	{
		name: "Input",
		description:
			"A text input field. Props: type ('text'|'email'|'password'|'number'|'search'|'url'|'tel'|'file'), value, placeholder, disabled, name, required.",
		props: InputSchema,
	},
	{
		name: "Label",
		description:
			"A label for form controls. Props: for (associated input id), children (label text).",
		props: LabelSchema,
	},
	{
		name: "RadioGroup",
		description:
			"A single-choice radio group. Props: value, name, orientation ('vertical'|'horizontal'), options (array of {value, label, description?, disabled?}).",
		props: RadioGroupSchema,
	},
	{
		name: "Progress",
		description:
			"A progress indicator showing completion percentage. Props: value (current number), max (total, default 100).",
		props: ProgressSchema,
	},
	{
		name: "ScrollArea",
		description:
			"A scrollable content area. Props: orientation ('vertical'|'horizontal'|'both'), children.",
		props: ScrollAreaSchema,
	},
	{
		name: "Separator",
		description:
			"A visual separator. Props: orientation ('horizontal'|'vertical'), decorative (optional). Example: Separator('horizontal', true)",
		props: SeparatorSchema,
	},
	{
		name: "Slider",
		description:
			"A slider for numeric values. Props: value (array), min, max, step, type ('single'|'multiple'), orientation, disabled.",
		props: SliderSchema,
	},
	{
		name: "Stack",
		description:
			"A flexible stack layout. Props: children (array), direction ('vertical'|'horizontal'), gap ('s'|'m'|'l'). Example: Stack(children, 'horizontal', 'm')",
		props: StackSchema,
	},
	{
		name: "Skeleton",
		description:
			"A loading placeholder block. Props: class (custom styling). Shows animated placeholder while content loads.",
		props: SkeletonSchema,
	},
	{
		name: "Switch",
		description: "A binary toggle switch. Props: checked, disabled, name, value, required.",
		props: SwitchSchema,
	},
	{
		name: "Tabs",
		description:
			"Tabbed content sections. Props: value (active tab), items (array of {value, label, content?}).",
		props: TabsSchema,
	},
	{
		name: "Text",
		description:
			"A text block for displaying plain content. Props: value (string), variant ('default'|'muted'|'title'), class.",
		props: TextSchema,
	},
	{
		name: "Textarea",
		description:
			"A multiline text input. Props: value, placeholder, disabled, name, rows, required.",
		props: TextareaSchema,
	},
	{
		name: "Toggle",
		description:
			"A pressable toggle control (button-style). Props: variant ('default'|'outline'), size ('default'|'sm'|'lg'), pressed, disabled, children.",
		props: ToggleSchema,
	},
	{
		name: "ToggleGroup",
		description:
			"A grouped set of toggles. Props: type ('single'|'multiple'), value, variant, size, items (array of {value, label, disabled?}).",
		props: ToggleGroupSchema,
	},
	{
		name: "Avatar",
		description:
			"A user avatar with image and fallback. Props: src (URL), alt (description), fallback (initials).",
		props: AvatarSchema,
	},
	{
		name: "Accordion",
		description:
			"A vertical list of expandable sections. Props: type ('single'|'multiple'), value, items (array of {value, title, content}).",
		props: AccordionSchema,
	},
	{
		name: "Collapsible",
		description:
			"A disclosure section that can expand or collapse. Props: open, label, content.",
		props: CollapsibleSchema,
	},
	{
		name: "Table",
		description:
			"A simple data table. First arg is columns (array of header strings), second arg is rows (2D array of data).",
		props: TableSchema,
	},
	{
		name: "BarChart",
		description:
			"A categorical bar chart. Use named object only: {title?, labels: [], series: [{label, values: [], color?}], height?, showLegend?}. Example: BarChart({labels: ['Q1'], series: [{label: 'A', values: [30]}]})",
		props: BarChartSchema,
	},
	{
		name: "LineChart",
		description:
			"A line chart for trends. Use named object only: {title?, labels: [], series: [{label, values: [], color?, fill?}], height?, showLegend?}. Example: LineChart({labels: ['2020'], series: [{label: 'Sales', values: [100]}]})",
		props: LineChartSchema,
	},
	{
		name: "DoughnutChart",
		description:
			"A doughnut chart for composition. Use named object only: {title?, items: [{label, value, color?}], height?, showLegend?}. Example: DoughnutChart({items: [{label: 'A', value: 45}]})",
		props: DoughnutChartSchema,
	},
] as const;
