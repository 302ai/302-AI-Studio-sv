import { type } from "arktype";

export const ThreadMetadata = type({
	threadIds: "string[]",
	favorites: "string[]",
});
export type ThreadMetadata = typeof ThreadMetadata.infer;
