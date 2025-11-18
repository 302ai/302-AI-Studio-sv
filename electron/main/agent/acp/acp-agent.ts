import { ACPConnection } from "./acp-connection";

export class ACPAgent {
	private connection: ACPConnection;

	constructor() {
		this.connection = new ACPConnection();
	}
}
