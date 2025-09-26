import { parse, stringify } from "superjson";

export function clone<T>(obj: T): T {
	return parse(stringify(obj));
}
