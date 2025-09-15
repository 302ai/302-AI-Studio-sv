import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

export async function markdownToHtml(md: string) {
	const processor = unified()
		.use(remarkParse) // Support basic Markdown
		.use(remarkGfm) // GitHub style Markdown
		.use(remarkRehype, { allowDangerousHtml: true }) // Convert to rehype with options
		.use(rehypeHighlight) // Add code highlighting
		.use(rehypeStringify, { allowDangerousHtml: true }); // Convert to HTML string

	const file = await processor.process(md);
	return String(file);
}
