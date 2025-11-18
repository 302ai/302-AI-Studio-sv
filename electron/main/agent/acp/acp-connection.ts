import { spawn, type ChildProcess } from "child_process";
import {
	JSONRPC_VERSION,
	type AcpMessage,
	type AcpRequest,
	type AcpResponse,
	type PendingRequest,
} from "../types/acpTypes";

export class ACPConnection {
	private child: ChildProcess | null = null;
	private pendingRequests = new Map();
	private nextRequestId = 0;
	private initializeResponse: AcpResponse | null = null;
	private sessionId: string | null = null;

	private sendRequest<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
		const id = this.nextRequestId++;
		const message: AcpRequest = {
			jsonrpc: JSONRPC_VERSION,
			id,
			method,
			...(params && { params }),
		};

		return new Promise((resolve, reject) => {
			// Use longer timeout for session/prompt requests as they involve LLM processing
			const timeoutDuration = method === "session/prompt" ? 120000 : 60000; // 2 minutes for prompts, 1 minute for others
			const startTime = Date.now();

			const createTimeoutHandler = () => {
				return setTimeout(() => {
					const request = this.pendingRequests.get(id);
					if (request && !request.isPaused) {
						this.pendingRequests.delete(id);
						const timeoutMsg =
							method === "session/prompt"
								? `LLM request timed out after ${timeoutDuration / 1000} seconds`
								: `Request ${method} timed out after ${timeoutDuration / 1000} seconds`;
						reject(new Error(timeoutMsg));
					}
				}, timeoutDuration);
			};

			const initialTimeout = createTimeoutHandler();

			const pendingRequest: PendingRequest<T> = {
				resolve: (value: T) => {
					if (pendingRequest.timeoutId) {
						clearTimeout(pendingRequest.timeoutId);
					}
					resolve(value);
				},
				reject: (error: Error) => {
					if (pendingRequest.timeoutId) {
						clearTimeout(pendingRequest.timeoutId);
					}
					reject(error);
				},
				timeoutId: initialTimeout,
				method,
				isPaused: false,
				startTime,
				timeoutDuration,
			};

			this.pendingRequests.set(id, pendingRequest);

			// this.sendMessage(message);

			console.log("[ACP] Sending request:", JSON.stringify(message));
		});
	}

	private async initialize(): Promise<AcpResponse> {
		const initializeParams = {
			protocolVersion: 1,
			clientCapabilities: {
				fs: {
					readTextFile: true,
					writeTextFile: true,
				},
			},
		};

		const response = await this.sendRequest<AcpResponse>("initialize", initializeParams);

		this.initializeResponse = response;
		return response;
	}

	private async setupChildProcessHandlers(backend: string): Promise<void> {
		let spawnError: Error | null = null;

		// Check if process is still running
		if (!this.child || this.child.killed) {
			throw new Error(`${backend} ACP process failed to start or exited immediately`);
		}

		this.child.stderr?.on("data", (data) => {
			console.error(`[ACP ${backend} STDERR]:`, data.toString());
		});

		this.child.on("error", (error) => {
			spawnError = error;
		});

		this.child.on("exit", (code, signal) => {
			console.error(`[ACP ${backend}] Process exited with code: ${code}, signal: ${signal}`);
			if (code !== 0) {
				if (!spawnError) {
					spawnError = new Error(`${backend} ACP process failed with exit code: ${code}`);
				}
			}
		});

		// Wait a bit for the process to start
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Check if process spawn failed
		if (spawnError) {
			throw spawnError;
		}

		// Handle messages from ACP server
		let buffer = "";
		this.child.stdout?.on("data", (data) => {
			const dataStr = data.toString();
			buffer += dataStr;
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";

			for (const line of lines) {
				if (line.trim()) {
					try {
						const message = JSON.parse(line) as AcpMessage;
						console.log("AcpMessage==>", JSON.stringify(message));
					} catch (_serror) {
						// Ignore parsing errors for non-JSON messages
					}
				}
			}
		});

		// Initialize protocol with timeout
		await Promise.race([
			this.initialize(),
			new Promise((_, reject) =>
				setTimeout(() => {
					reject(new Error("Initialize timeout after 60 seconds"));
				}, 60000),
			),
		]);
	}

	private async connectClaudeCode(workspacePath: string = process.cwd()): Promise<void> {
		// Clean environment
		const cleanEnv = { ...process.env };
		delete cleanEnv.NODE_OPTIONS;
		delete cleanEnv.NODE_INSPECT;
		delete cleanEnv.NODE_DEBUG;

		const isWindows = process.platform === "win32";
		const spawnCommand = isWindows ? "npx.cmd" : "npx";
		const spawnArgs = ["@zed-industries/claude-code-acp"];

		this.child = spawn(spawnCommand, spawnArgs, {
			cwd: workspacePath,
			stdio: ["pipe", "pipe", "pipe"],
			env: cleanEnv,
			shell: isWindows,
		});

		await this.setupChildProcessHandlers("claude");
	}

	async newSession(cwd: string = process.cwd()): Promise<AcpResponse> {
		const response = await this.sendRequest<AcpResponse & { sessionId?: string }>("session/new", {
			cwd,
			mcpServers: [] as unknown[],
		});

		this.sessionId = response.sessionId || null;
		return response;
	}

	async sendPrompt(prompt: string): Promise<AcpResponse> {
		if (!this.sessionId) {
			throw new Error("No active ACP session");
		}

		// console.log('Sending ACP session...', prompt);

		return await this.sendRequest("session/prompt", {
			sessionId: this.sessionId,
			prompt: [{ type: "text", text: prompt }],
		});
	}

	async connect() {
		if (this.child) {
			this.disconnect();
		}

		await this.connectClaudeCode();
	}

	getInitializeResponse(): AcpResponse | null {
		return this.initializeResponse;
	}

	disconnect(): void {
		if (this.child) {
			this.child.kill();
			this.child = null;
		}

		// Reset state
		this.pendingRequests.clear();
		this.initializeResponse = null;
		this.sessionId = null;
	}
}
