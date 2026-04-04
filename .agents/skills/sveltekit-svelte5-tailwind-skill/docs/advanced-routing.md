---
title: "Advanced SvelteKit Routing"
version_anchors: ["SvelteKit@2.x"]
authored: true
origin: self
adapted_from:
    - "sveltejs/kit#4991df5 (SvelteKit advanced routing documentation)"
last_reviewed: 2025-10-28
summary: "Complete guide to advanced SvelteKit routing including rest parameters, optional parameters, matchers, route groups, layout breaking, encoding, and sorting"
---

# Advanced SvelteKit Routing

Complete guide to advanced routing patterns in SvelteKit 2.x, covering dynamic routes, layout manipulation, and custom routing behavior.

## Rest Parameters

Capture an unknown number of path segments.

### Syntax

```
/[org]/[repo]/tree/[branch]/[...file]
```

### Example

**Route structure:**

```
src/routes/[org]/[repo]/tree/[branch]/[...file]/+page.svelte
```

**Request:** `/sveltejs/kit/tree/main/documentation/docs/routing.md`

**Parameters:**

```js
{
	org: 'sveltejs',
	repo: 'kit',
	branch: 'main',
	file: 'documentation/docs/routing.md'
}
```

### Empty Rest Parameters

Rest parameters match zero or more segments:

```
src/routes/a/[...rest]/z/+page.svelte
```

**Matches:**

- `/a/z` → `rest: undefined`
- `/a/b/z` → `rest: 'b'`
- `/a/b/c/z` → `rest: 'b/c'`

**Validation:**

```js
// src/routes/a/[...rest]/z/+page.js
export function load({ params }) {
	// Validate rest parameter
	if (params.rest && !isValidPath(params.rest)) {
		error(404, "Invalid path");
	}

	return { path: params.rest };
}
```

### Custom 404 Pages with Rest Parameters

```
src/routes/
├── marx-brothers/
│   ├── [...path]/
│   │   └── +page.js
│   ├── chico/
│   │   └── +page.svelte
│   ├── harpo/
│   │   └── +page.svelte
│   ├── groucho/
│   │   └── +page.svelte
│   └── +error.svelte
└── +error.svelte
```

```js
// src/routes/marx-brothers/[...path]/+page.js
import { error } from "@sveltejs/kit";

export function load({ params }) {
	error(404, `Marx brother '${params.path}' not found`);
}
```

## Optional Parameters

Make route segments optional by wrapping in double brackets.

### Syntax

```
src/routes/[[lang]]/home/+page.svelte
```

**Matches:**

- `/home` → `lang: undefined`
- `/en/home` → `lang: 'en'`
- `/fr/home` → `lang: 'fr'`

### Multiple Optional Parameters

```
src/routes/[[lang]]/[[category]]/products/+page.svelte
```

**Matches:**

- `/products`
- `/en/products`
- `/electronics/products`
- `/en/electronics/products`

### With Matchers

```
src/routes/[[lang=locale]]/+layout.js
```

```js
// src/params/locale.js
export function match(param) {
	return /^(en|fr|de)$/.test(param);
}
```

### Invalid Combinations

❌ **Cannot follow rest parameter:**

```
src/routes/[...rest]/[[optional]]/+page.svelte  // INVALID
```

Rest parameters are "greedy" and consume all segments, leaving nothing for the optional parameter.

## Matchers

Validate route parameters with custom logic.

### Creating Matchers

**Matcher file:**

```js
// src/params/integer.js
/**
 * @param {string} param
 * @return {param is string}
 * @satisfies {import('@sveltejs/kit').ParamMatcher}
 */
export function match(param) {
	return /^\d+$/.test(param);
}
```

**Usage in route:**

```
src/routes/blog/[id=integer]/+page.svelte
```

**Behavior:**

- `/blog/123` → ✅ Matches
- `/blog/abc` → ❌ Doesn't match (tries other routes or returns 404)

### Common Matchers

**UUID matcher:**

```js
// src/params/uuid.js
export function match(param) {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(param);
}
```

**Date matcher:**

```js
// src/params/date.js
export function match(param) {
	return /^\d{4}-\d{2}-\d{2}$/.test(param) && !isNaN(Date.parse(param));
}
```

**Enum matcher:**

```js
// src/params/category.js
const validCategories = ["electronics", "clothing", "books"];

export function match(param) {
	return validCategories.includes(param);
}
```

### TypeScript Type Guards

```ts
// src/params/fruit.ts
export function match(param: string): param is "apple" | "orange" {
	return param === "apple" || param === "orange";
}
```

### Matcher Execution

- Matchers run on both server and client
- Must be synchronous
- Should be fast (checked on every navigation)
- Return `true` for valid, `false` for invalid

### Testing Matchers

```js
// src/params/integer.test.js
import { match } from "./integer.js";

describe("integer matcher", () => {
	it("matches valid integers", () => {
		expect(match("123")).toBe(true);
		expect(match("0")).toBe(true);
	});

	it("rejects invalid integers", () => {
		expect(match("abc")).toBe(false);
		expect(match("12.34")).toBe(false);
		expect(match("")).toBe(false);
	});
});
```

## Route Sorting

When multiple routes match a URL, SvelteKit uses specific rules to determine priority.

### Sorting Rules (Highest to Lowest Priority)

1. **Specificity:** More specific routes rank higher
2. **Matchers:** Parameters with matchers rank higher than those without
3. **Optional/Rest:** `[[optional]]` and `[...rest]` have lowest priority
4. **Alphabetical:** Ties resolved alphabetically

### Examples

**Routes:**

```
src/routes/foo-abc/+page.svelte
src/routes/foo-[c]/+page.svelte
src/routes/[[a=x]]/+page.svelte
src/routes/[b]/+page.svelte
src/routes/[...catchall]/+page.svelte
```

**Sorted priority:**

1. `/foo-abc` (most specific)
2. `/foo-[c]` (specific prefix)
3. `/[[a=x]]` (matcher)
4. `/[b]` (simple parameter)
5. `/[...catchall]` (rest parameter, lowest)

**URL matches:**

- `/foo-abc` → Route 1
- `/foo-def` → Route 2
- `/bar` → Route 4
- `/anything/else` → Route 5

### Layout Precedence

Optional parameters in layouts are ignored for sorting:

```
src/routes/
├── [[lang]]/
│   └── +layout.svelte
└── admin/
	└── +page.svelte
```

For sorting purposes, `[[lang]]` is treated as if it doesn't exist. The `/admin` route doesn't inherit the `[[lang]]` layout.

## Advanced Layouts

Manipulate the layout hierarchy for complex applications.

### Route Groups

Group routes with shared layouts using `(name)` directories.

```
src/routes/
├── (app)/
│   ├── dashboard/
│   ├── settings/
│   └── +layout.svelte
├── (marketing)/
│   ├── about/
│   ├── pricing/
│   └── +layout.svelte
└── +layout.svelte
```

**URLs:**

- `/dashboard` (uses (app) layout)
- `/settings` (uses (app) layout)
- `/about` (uses (marketing) layout)
- `/pricing` (uses (marketing) layout)

**Group characteristics:**

- Don't affect URL structure
- Can have their own `+layout.svelte`
- Can have `+page.svelte` at group level

### Breaking Out of Layouts

Use `@` to skip layout levels.

**Route structure:**

```
src/routes/
├── (app)/
│   ├── item/
│   │   ├── [id]/
│   │   │   ├── embed/
│   │   │   │   └── +page.svelte
│   │   │   └── +layout.svelte
│   │   └── +layout.svelte
│   └── +layout.svelte
└── +layout.svelte
```

**Without breaking out:**

- Page inherits: root → (app) → item → [id] layouts

**With `+page@(app).svelte`:**

```
src/routes/(app)/item/[id]/embed/+page@(app).svelte
```

- Page inherits: root → (app) layouts only

**Reset to root:**

```
src/routes/(app)/item/[id]/embed/+page@.svelte
```

- Page inherits: root layout only

### Layout Breaking Options

```
+page@[id].svelte     → Inherit from [id] layout
+page@item.svelte     → Inherit from item layout
+page@(app).svelte    → Inherit from (app) layout
+page@.svelte         → Inherit from root layout only
```

### Breaking Layouts Themselves

Layouts can break out of their parent hierarchy:

```
src/routes/
├── (app)/
│   ├── item/
│   │   ├── [id]/
│   │   │   ├── +layout.svelte
│   │   │   └── +page.svelte
│   │   └── +layout@.svelte  ← Breaks out to root
│   └── +layout.svelte
└── +layout.svelte
```

**Result:**

- `item/+layout@.svelte` inherits from root only
- `[id]/+layout.svelte` inherits from `item/+layout@.svelte`
- `[id]/+page.svelte` inherits from `[id]/+layout.svelte`

### When to Use Layout Groups

✅ **Good use cases:**

- Separate app and marketing sections
- Different authentication requirements
- Distinct navigation/UI patterns

❌ **Avoid overusing:**

- Complex nesting can be hard to maintain
- Consider composition instead (reusable components/functions)
- Use if-statements for simple variations

**Alternative approach:**

```svelte
<!-- src/routes/nested/route/+layout@.svelte -->
<script>
	import ReusableLayout from "$lib/ReusableLayout.svelte";
	let { data, children } = $props();
</script>

<ReusableLayout {data}>
	{@render children()}
</ReusableLayout>
```

## Character Encoding

Use special characters in routes with encoding.

### Hexadecimal Encoding

Format: `[x+nn]` where `nn` is the hexadecimal character code.

**Special characters:**

- `\` → `[x+5c]`
- `/` → `[x+2f]`
- `:` → `[x+3a]`
- `*` → `[x+2a]`
- `?` → `[x+3f]`
- `"` → `[x+22]`
- `<` → `[x+3c]`
- `>` → `[x+3e]`
- `|` → `[x+7c]`
- `#` → `[x+23]`
- `%` → `[x+25]`
- `[` → `[x+5b]`
- `]` → `[x+5d]`
- `(` → `[x+28]`
- `)` → `[x+29]`

### Examples

**Smiley route:**

```
src/routes/smileys/[x+3a]-[x+29]/+page.svelte
```

**URL:** `/smileys/:-)`

**Hash route:**

```
src/routes/[x+23]tag/+page.svelte
```

**URL:** `/#tag`

**Finding character codes:**

```js
":".charCodeAt(0).toString(16); // '3a'
")".charCodeAt(0).toString(16); // '29'
```

### Unicode Encoding

Format: `[u+nnnn]` where `nnnn` is a Unicode code point (0000-10ffff).

**Examples:**

```
src/routes/[u+d83e][u+dd2a]/+page.svelte
src/routes/🤪/+page.svelte  // Equivalent
```

**When to use:**

- Emoji in routes
- Special Unicode characters
- When file system doesn't support character

### Well-Known URIs

```
src/routes/[x+2e]well-known/change-password/+page.svelte
```

**URL:** `/.well-known/change-password`

**Why encode `.`:** TypeScript struggles with leading dots in directory names.

## Advanced Routing Patterns

### Catch-All with Validation

```js
// src/routes/[...path]/+page.js
import { error } from "@sveltejs/kit";

const validPaths = ["docs", "blog", "about"];

export function load({ params }) {
	const segments = params.path?.split("/") || [];
	const base = segments[0];

	if (!validPaths.includes(base)) {
		error(404, "Section not found");
	}

	return { segments };
}
```

### Nested Optional Parameters

```js
// src/routes/[[lang]]/shop/[[category]]/+page.js
export function load({ params }) {
	return {
		lang: params.lang || "en",
		category: params.category || "all",
	};
}
```

### Dynamic Layouts with Groups

```
src/routes/
├── (authed)/
│   ├── +layout.server.js  ← Auth check
│   ├── dashboard/
│   └── settings/
├── (public)/
│   ├── +layout.svelte  ← Public layout
│   ├── login/
│   └── register/
└── +layout.svelte  ← Root layout
```

```js
// src/routes/(authed)/+layout.server.js
import { redirect } from "@sveltejs/kit";

export async function load({ locals }) {
	if (!locals.user) {
		redirect(307, "/login");
	}

	return { user: locals.user };
}
```

### Parallel Routes

Handle different parameter types:

```
src/routes/
├── items/
│   ├── [id=integer]/  ← Numeric IDs
│   │   └── +page.svelte
│   └── [slug]/  ← String slugs
│       └── +page.svelte
```

### Conditional Layout Inheritance

```svelte
<!-- src/routes/special/+layout.svelte -->
<script>
	import { page } from "$app/state";
	import StandardLayout from "$lib/layouts/Standard.svelte";
	import SpecialLayout from "$lib/layouts/Special.svelte";

	let { children } = $props();
	let useSpecial = $derived(page.url.searchParams.has("special"));
</script>

{#if useSpecial}
	<SpecialLayout>
		{@render children()}
	</SpecialLayout>
{:else}
	<StandardLayout>
		{@render children()}
	</StandardLayout>
{/if}
```

## Route Debugging

### Check Route Matching

```js
// src/routes/debug/+page.server.js
export function load({ route }) {
	return {
		routeId: route.id,
		pattern: route.pattern,
	};
}
```

### Log Route Parameters

```js
// src/hooks.server.js
export async function handle({ event, resolve }) {
	console.log("Route:", event.route.id);
	console.log("Params:", event.params);
	console.log("URL:", event.url.pathname);

	return resolve(event);
}
```

### Validate Route Structure

```js
// src/routes/[param]/+page.js
export function load({ params }) {
	console.log("Parameter received:", params.param);

	// Check if matcher is working
	if (!params.param) {
		console.warn("Parameter is empty");
	}

	return { param: params.param };
}
```

## Performance Considerations

### Matcher Performance

❌ **Slow - database lookup:**

```js
export async function match(param) {
	const exists = await db.checkExists(param);
	return exists; // WRONG - matchers must be synchronous
}
```

✅ **Fast - regex check:**

```js
export function match(param) {
	return /^[a-z0-9-]+$/.test(param);
}
```

### Route Organization

✅ **Good - specific routes:**

```
src/routes/
├── blog/[slug]/
├── docs/[category]/[page]/
└── api/users/[id]/
```

❌ **Avoid - too many catch-alls:**

```
src/routes/
├── [...all]/
└── [[...maybe]]/
```

### Layout Optimization

Minimize layout re-renders by keeping layouts stable:

```svelte
<!-- Good - layout changes rarely -->
<script>
	let { children } = $props();
</script>

<nav>
	<!-- Static navigation -->
</nav>

<main>
	{@render children()}
</main>
```

## Common Patterns

### Multi-Language Routing

```
src/routes/
├── [[lang=locale]]/
│   ├── +layout.js
│   ├── about/
│   └── contact/
```

```js
// src/params/locale.js
export function match(param) {
	return /^(en|fr|de|es)$/.test(param);
}
```

```js
// src/routes/[[lang]]/+layout.js
export function load({ params }) {
	const lang = params.lang || "en";
	return { lang, messages: translations[lang] };
}
```

### Versioned API Routes

```
src/routes/
├── api/
│   ├── v1/
│   │   └── users/
│   ├── v2/
│   │   └── users/
│   └── [[version=apiVersion]]/
│       └── users/
```

```js
// src/params/apiVersion.js
export function match(param) {
	return /^v[1-2]$/.test(param);
}
```

### Admin Dashboard

```
src/routes/
├── (app)/
│   └── +layout.svelte
├── (admin)/
│   ├── +layout.server.js  ← Admin auth check
│   ├── +layout.svelte
│   └── [resource]/
│       ├── +page.svelte
│       └── [id]/
│           └── +page.svelte
└── +layout.svelte
```
