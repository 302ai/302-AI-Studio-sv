<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow,
	} from "$lib/components/ui/table";

	type OpenUITableProps = {
		class?: string;
		columns?: string[];
		rows?: Array<Array<string | number | boolean | null>>;
	};

	let { props }: ComponentRenderProps<OpenUITableProps> = $props();
</script>

<Table class={props.class}>
	<TableHeader>
		<TableRow>
			{#each props.columns ?? [] as column, columnIndex (`${columnIndex}-${column}`)}
				<TableHead>{column}</TableHead>
			{/each}
		</TableRow>
	</TableHeader>
	<TableBody>
		{#each props.rows ?? [] as row, rowIndex (`${rowIndex}-${JSON.stringify(row)}`)}
			<TableRow>
				{#each row as cell, cellIndex (`${rowIndex}-${cellIndex}-${String(cell)}`)}
					<TableCell>{cell == null ? "" : String(cell)}</TableCell>
				{/each}
			</TableRow>
		{/each}
	</TableBody>
</Table>
