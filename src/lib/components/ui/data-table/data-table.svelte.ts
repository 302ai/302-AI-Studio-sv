import {
	type RowData,
	type TableOptions,
	type TableOptionsResolved,
	type TableState,
	type Updater,
	createTable,
} from "@tanstack/table-core";
import { SvelteSet } from "svelte/reactivity";

/**
 * Creates a reactive TanStack table object for Svelte.
 * @param options Table options to create the table with.
 * @returns A reactive table object.
 * @example
 * ```svelte
 * <script>
 *   const table = createSvelteTable({ ... })
 * </script>
 *
 * <table>
 *   <thead>
 *     {#each table.getHeaderGroups() as headerGroup}
 *       <tr>
 *         {#each headerGroup.headers as header}
 *           <th colspan={header.colSpan}>
 *         	   <FlexRender content={header.column.columnDef.header} context={header.getContext()} />
 *         	 </th>
 *         {/each}
 *       </tr>
 *     {/each}
 *   </thead>
 * 	 <!-- ... -->
 * </table>
 * ```
 */
export function createSvelteTable<TData extends RowData>(options: TableOptions<TData>) {
	const defaultOptions: Partial<TableOptionsResolved<TData>> = {
		state: {},
		onStateChange() {},
		renderFallbackValue: null,
	};

	const resolvedOptions: TableOptionsResolved<TData> = mergeObjects(
		defaultOptions as TableOptionsResolved<TData>,
		options as Partial<TableOptionsResolved<TData>>,
	);

	const table = createTable(resolvedOptions);
	let state = $state<Partial<TableState>>(table.initialState);

	function updateOptions() {
		table.setOptions((prev) => {
			const mergedOptions = mergeObjects(
				prev,
				options as Partial<TableOptionsResolved<TData>>,
			) as TableOptionsResolved<TData>;

			// Override with our custom state handling
			return {
				...mergedOptions,
				state: {
					...table.initialState,
					...state,
					...(options.state || {}),
				},
				onStateChange: (updater: Updater<TableState>) => {
					if (updater instanceof Function) state = updater(state as TableState);
					else state = { ...state, ...updater };

					options.onStateChange?.(updater);
				},
			};
		});
	}

	updateOptions();

	$effect.pre(() => {
		updateOptions();
	});

	return table;
}

type MaybeThunk<T extends object> = T | (() => T | null | undefined);
type Intersection<T extends readonly unknown[]> = (T extends [infer H, ...infer R]
	? H & Intersection<R>
	: unknown) & {};

/**
 * Lazily merges several objects (or thunks) while preserving
 * getter semantics from every source.
 *
 * Proxy-based to avoid known WebKit recursion issue.
 */

export function mergeObjects<Sources extends readonly MaybeThunk<object>[]>(
	...sources: Sources
): Intersection<Sources> {
	const resolve = <T extends object>(src: MaybeThunk<T>): T | undefined =>
		typeof src === "function" ? (src() ?? undefined) : src;

	const findSourceWithKey = (key: PropertyKey) => {
		for (let i = sources.length - 1; i >= 0; i--) {
			const obj = resolve(sources[i]);
			if (obj && key in obj) return obj;
		}
		return undefined;
	};

	return new Proxy(Object.create(null), {
		get(_, key) {
			const src = findSourceWithKey(key);

			return src?.[key as never];
		},

		has(_, key) {
			return !!findSourceWithKey(key);
		},

		ownKeys(): (string | symbol)[] {
			const all = new SvelteSet<string | symbol>();
			for (const s of sources) {
				const obj = resolve(s);
				if (obj) {
					for (const k of Reflect.ownKeys(obj) as (string | symbol)[]) {
						all.add(k);
					}
				}
			}
			return [...all];
		},

		getOwnPropertyDescriptor(_, key) {
			const src = findSourceWithKey(key);
			if (!src) return undefined;
			return {
				configurable: true,
				enumerable: true,

				value: (src as Record<PropertyKey, unknown>)[key],
				writable: true,
			};
		},
	}) as Intersection<{ [K in keyof Sources]: Sources[K] }>;
}
