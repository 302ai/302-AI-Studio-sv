# Adding a UI Component

Step-by-step guide for adding new UI components.

## Decision: Component Type

**Is it reusable across features?**

- ✅ Yes → Base UI component (`src/lib/components/ui/`)
- ❌ No → Business component (`src/lib/components/buss/`)

See [Code Location Decision Tree](../decision-trees/code-location.md) for details.

## Workflow A: Base UI Component

For reusable components following Shadcn-Svelte patterns.

### 1. Create Component Directory

```bash
mkdir -p src/lib/components/ui/my-component
```

### 2. Create Component File

```bash
touch src/lib/components/ui/my-component/my-component.svelte
```

### 3. Implement Component

```svelte
<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	interface Props {
		variant?: "default" | "outline" | "ghost";
		size?: "sm" | "md" | "lg";
		disabled?: boolean;
		class?: string;
		children?: Snippet;
	}

	let {
		variant = "default",
		size = "md",
		disabled = false,
		class: className,
		children,
		...restProps
	}: Props = $props();
</script>

<div
	class={cn(
		"my-component-base",
		{
			"variant-default": variant === "default",
			"variant-outline": variant === "outline",
			"variant-ghost": variant === "ghost",
			"size-sm": size === "sm",
			"size-md": size === "md",
			"size-lg": size === "lg",
			disabled: disabled,
		},
		className,
	)}
	{...restProps}
>
	{#if children}
		{@render children()}
	{/if}
</div>

<style>
	.my-component-base {
		/* Base styles using CSS variables */
		background: var(--ui-background);
		color: var(--ui-foreground);
	}

	.variant-default {
		/* Default variant styles */
	}

	/* More variant styles... */
</style>
```

### 4. Create Index File

```bash
touch src/lib/components/ui/my-component/index.ts
```

```typescript
export { default as MyComponent } from "./my-component.svelte";
export type { Props as MyComponentProps } from "./my-component.svelte";
```

### 5. Add to UI Index

```typescript
// src/lib/components/ui/index.ts
export * from "./my-component";
```

### 6. Usage

```svelte
<script>
	import { MyComponent } from "$lib/components/ui";
</script>

<MyComponent variant="outline" size="lg">Content here</MyComponent>
```

## Workflow B: Business Component

For feature-specific components with business logic.

### 1. Determine Feature Category

```bash
# Check existing categories
ls src/lib/components/buss/

# Common categories:
# - chat/
# - code-agent/
# - model-*/
# - provider-*/
# - mcp-*/
# - theme-*/
# - plugin-*/
# - settings/
```

### 2. Create Component File

```bash
# If category exists
touch src/lib/components/buss/chat/my-feature.svelte

# If new category needed
mkdir -p src/lib/components/buss/my-feature
touch src/lib/components/buss/my-feature/my-component.svelte
```

### 3. Implement with State Integration

```svelte
<script lang="ts">
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { Button } from "$lib/components/ui";
	import type { ChatMessage } from "$lib/types/chat";

	interface Props {
		threadId: string;
		class?: string;
	}

	let { threadId, class: className }: Props = $props();

	// Access state
	const messages = $derived(chatState.messages);
	const isLoading = $derived(chatState.isLoading);

	// Local component state
	let expanded = $state(false);

	// Actions
	function handleAction() {
		chatState.sendMessage();
	}
</script>

<div class={className}>
	<Button onclick={handleAction} disabled={isLoading}>Send</Button>

	{#each messages as message}
		<div>{message.content}</div>
	{/each}
</div>
```

### 4. Add IPC Integration (if needed)

```svelte
<script lang="ts">
	import { onMount } from "svelte";

	let data = $state<MyData | null>(null);

	onMount(async () => {
		data = await window.electronAPI.myService.getData();
	});

	async function saveData() {
		await window.electronAPI.myService.saveData(data);
	}
</script>
```

### 5. Usage in Route

```svelte
<!-- src/routes/(with-sidebar)/chat/[id]/+page.svelte -->
<script>
	import MyFeature from "$lib/components/buss/chat/my-feature.svelte";
</script>

<MyFeature threadId={data.id} />
```

## Component Patterns

### Pattern: Snippet Children

```svelte
<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		header?: Snippet;
		children: Snippet;
		footer?: Snippet;
	}

	let { header, children, footer }: Props = $props();
</script>

<div>
	{#if header}
		<header>{@render header()}</header>
	{/if}

	<main>{@render children()}</main>

	{#if footer}
		<footer>{@render footer()}</footer>
	{/if}
</div>
```

### Pattern: Event Handlers

```svelte
<script lang="ts">
	interface Props {
		onclick?: (e: MouseEvent) => void;
		onsubmit?: (data: FormData) => void;
	}

	let { onclick, onsubmit }: Props = $props();
</script>

<button {onclick}>Click</button>
```

### Pattern: Forwarding Props

```svelte
<script lang="ts">
	import { Button } from "$lib/components/ui";

	interface Props {
		variant?: "default" | "outline";
		[key: string]: any;
	}

	let { variant = "default", ...restProps }: Props = $props();
</script>

<Button {variant} {...restProps}>
	<slot />
</Button>
```

## Styling Guidelines

### Use CSS Variables

```css
.my-component {
	background: var(--ui-background);
	color: var(--ui-foreground);
	border: 1px solid var(--ui-border);
	border-radius: var(--ui-radius);
}
```

### Use Tailwind Classes

```svelte
<div class="flex items-center gap-2 p-4 rounded-lg bg-background">Content</div>
```

### Combine with cn() Utility

```svelte
<script>
	import { cn } from "$lib/utils";

	let { class: className }: { class?: string } = $props();
</script>

<div class={cn("base-classes", className)}>Content</div>
```

## Internationalization

```svelte
<script>
	import * as m from "$lib/paraglide/messages";
</script>

<h1>{m.myComponentTitle()}</h1><p>{m.myComponentDescription()}</p>
```

Add keys to `/messages/en.json` and `/messages/zh.json`.

## Testing

```typescript
// src/lib/components/ui/my-component/my-component.test.ts
import { render } from "@testing-library/svelte";
import MyComponent from "./my-component.svelte";

describe("MyComponent", () => {
	it("renders with default props", () => {
		const { container } = render(MyComponent);
		expect(container).toBeTruthy();
	});

	it("applies variant classes", () => {
		const { container } = render(MyComponent, {
			props: { variant: "outline" },
		});
		expect(container.querySelector(".variant-outline")).toBeTruthy();
	});
});
```

## Quality Checklist

- [ ] Component follows naming conventions
- [ ] Props interface defined with TypeScript
- [ ] Uses Svelte 5 runes (`$state`, `$derived`, `$props`)
- [ ] Styles use CSS variables or Tailwind
- [ ] Internationalization keys added (if text present)
- [ ] Accessible (ARIA labels, keyboard navigation)
- [ ] Responsive design considered
- [ ] Tests added for critical paths
- [ ] No console.log (use logger if needed)
- [ ] Passes `pnpm quality`

## See Also

- [Component Template](../patterns/component-template.md)
- [Code Location Decision Tree](../decision-trees/code-location.md)
- [Tech Stack](../references/tech-stack.md)
