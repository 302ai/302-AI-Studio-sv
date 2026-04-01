/**
 *Description: wechat channel login
 *Author: Leessmin
 *Date: 2026-03-26
 **/

import type { OpenClawWeixinLoginMsg } from "@shared/types";
import { createLogger } from "@shared/logger";

const logger = createLogger("app");
import { exec, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import * as readline from "node:readline";
import { promisify } from "node:util";
import { broadcastService } from "../broadcast-service";
class WeChatChannel {
	private execAsync = promisify(exec);

	private commandProcess: ChildProcessWithoutNullStreams | null = null;
	private isConnecting = false;
	private isManual = false;

	private isMissingProcessError = (error: unknown): error is NodeJS.ErrnoException => {
		return error instanceof Error && "code" in error && error.code === "ESRCH";
	};

	private stopCommandProcess = async (proc: ChildProcessWithoutNullStreams) => {
		if (proc.killed || proc.pid == null) return;

		if (process.platform === "win32") {
			proc.kill("SIGTERM");
			await once(proc, "close");
			return;
		}

		try {
			process.kill(-proc.pid, "SIGTERM");
			await once(proc, "close");
		} catch (error) {
			if (!this.isMissingProcessError(error)) {
				throw error;
			}
		}
	};

	private async clearCommand() {
		if (this.commandProcess) {
			const old = this.commandProcess;
			if (!old.killed) {
				await this.stopCommandProcess(old);
				this.commandProcess = null;
				this.isManual = true;
			}
		}
	}

	private executeCommand = async (
		command: string,
		stdoutFn: (d: string) => void,
		stderrFn: (d: string) => void,
		closeFn?: (manual: boolean) => void,
	) => {
		try {
			await this.clearCommand();

			const proc = spawn("podman", ["exec", "-i", "local-cc-api", "bash", "-c", command], {
				detached: process.platform !== "win32",
			});
			this.commandProcess = proc;

			const rl = readline.createInterface({
				input: proc.stdout,
				crlfDelay: Infinity,
			});

			rl.on("line", stdoutFn);
			proc.once("close", (code) => {
				logger.info(`openclaw: Child process exited with code ${code}`);
				rl.close();
				proc.stdout.removeAllListeners();
				proc.stderr.removeAllListeners();
				if (code != 0) {
					if (this.isManual) return;
					stderrFn(`Error: ${code}`);
				} else {
					if (this.commandProcess === proc) {
						this.commandProcess = null;
						closeFn?.(this.isManual);
					}
				}
				this.isManual = false;
			});
		} catch (error) {
			logger.error("Failed to execute command:", error);
		}
	};

	async dispose() {
		await this.clearCommand();
	}

	/**
	 * start weixin login flow
	 * @param installed -  whether the channel is installed
	 * @returns void
	 */
	async startWeixinLoginFlow(installed: boolean = false) {
		// "openclaw channels login --channel openclaw-weixin"
		// "openclaw channels list"
		// npx -y @tencent-weixin/openclaw-weixin-cli install
		if (this.isConnecting) return;
		this.isConnecting = true;
		try {
			let command = "openclaw channels login --channel openclaw-weixin";
			if (!installed) {
				command = "npx -y @tencent-weixin/openclaw-weixin-cli install";
				broadcastService.broadcastChannelToAll("openclaw-weixin:login", {
					type: "install",
					data: "",
				});
			}

			this.executeCommand(
				command,
				(line: string) => {
					logger.info("openclaw-weixin:login:", line);
					let data: OpenClawWeixinLoginMsg = {
						type: "unknown",
						data: line,
					};
					if (line.includes("https://liteapp.weixin.qq.com")) {
						data = {
							type: "url",
							data: line,
						};

						if (!installed) {
							// installed successfully
							broadcastService.broadcastChannelToAll("openclaw-weixin:login", {
								type: "installed",
								data: "",
							});
						}
					} else if (line.includes("微信连接成功")) {
						data = {
							type: "ok",
							data: line,
						};
					} else if (line.includes("插件安装失败，请手动执行")) {
						data = {
							type: "error",
							data: line,
						};
					}

					broadcastService.broadcastChannelToAll("openclaw-weixin:login", data);
				},
				(err: string) => {
					logger.error("openclaw-weixin:login:error", err);
					broadcastService.broadcastChannelToAll("openclaw-weixin:login", {
						type: "error",
						data: err,
					});
				},
				(manual: boolean) => {
					broadcastService.broadcastChannelToAll("openclaw-weixin:login", {
						type: "close",
						data: manual ? "manual" : "",
					});
				},
			);
		} catch (e) {
			logger.error("openclaw-weixin:login:error", e);
		} finally {
			this.isConnecting = false;
		}
	}
}

export default WeChatChannel;
