/**
 *Description: wechat channel login
 *Author: Leessmin
 *Date: 2026-03-26
 **/

import { createLogger } from "@shared/logger";
import type { OpenClawWeixinLoginMsg } from "@shared/types";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import * as readline from "node:readline";
import { broadcastService } from "../broadcast-service";

const logger = createLogger("services");

// "openclaw channels login --channel openclaw-weixin"
// "openclaw channels list"
// npx -y @tencent-weixin/openclaw-weixin-cli install
class WeChatChannel {
	private commandProcess: ChildProcessWithoutNullStreams | null = null;
	private isConnecting = false;

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
			}
		}
	}

	private executeCommand = async (
		command: string,
		stdoutFn: (d: string) => void,
		stderrFn: (d: string) => void,
		closeFn?: (normal: boolean) => void,
	) => {
		try {
			await this.clearCommand();

			const proc = spawn("podman", ["exec", "-i", "local-cc-api", "bash", "-c", command], {
				detached: process.platform !== "win32",
			});
			this.commandProcess = proc;

			logger.debug(`Started command "${command}" with PID ${proc.pid}`);
			const rl = readline.createInterface({
				input: proc.stdout,
				crlfDelay: Infinity,
			});

			rl.on("line", stdoutFn);
			proc.stderr.on("data", (data) => {
				stderrFn(data.toString());
			});
			proc.once("close", (code) => {
				logger.debug(`openclaw: Child process exited with code ${code}`);
				rl.close();
				proc.stdout.removeAllListeners();
				proc.stderr.removeAllListeners();
				closeFn?.(code === 0);
				if (this.commandProcess === proc) {
					this.commandProcess = null;
				}
				if (code != 0) {
					logger.error(`Child process failed with code ${code}`);
				}
			});
		} catch (error) {
			logger.error("Failed to execute command:", error);
		}
	};

	async dispose() {
		await this.clearCommand();
	}

	/**
	 * Start the WeChat login process
	 * This method will execute the WeChat login command and handle the output, errors and close events through the callback function
	 * At the same time, it will broadcast different status messages to all subscribers through the broadcast service
	 */
	async startWeixinLogin() {
		if (this.isConnecting) return;
		this.isConnecting = true;
		try {
			const command = "openclaw channels login --channel openclaw-weixin";

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
					} else if (line.includes("微信连接成功")) {
						data = {
							type: "ok",
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
				(normal: boolean) => {
					broadcastService.broadcastChannelToAll("openclaw-weixin:login", {
						type: "close",
						data: normal ? "normal" : "abnormal",
					});
				},
			);
		} catch (e) {
			logger.error("openclaw-weixin:login:error", e);
		} finally {
			this.isConnecting = false;
		}
	}

	/**
	 * Method for installing WeChat
	 * @returns Returns a Promise that is resolved as a boolean value, indicating whether the installation was successful
	 */
	async wechatInstall(): Promise<boolean> {
		let timer: NodeJS.Timeout | null = null;
		try {
			return await new Promise((resolve, reject) => {
				const command = "npx -y @tencent-weixin/openclaw-weixin-cli install";

				// Set a timeout for the installation process to prevent it from hanging indefinitely
				timer = setTimeout(
					() => {
						logger.error("WeChat installation timed out");
						reject("Installation timeout");
					},
					1000 * 60 * 2,
				);

				this.executeCommand(
					command,
					(line: string) => {
						logger.debug(`WeChat install output: ${line}`);
						if (line.includes("https://liteapp.weixin.qq.com")) {
							// install command is actually running, not just checking
							resolve(true);
						} else if (line.includes("[openclaw-weixin] 插件就绪")) {
							resolve(true);
						} else if (line.includes("插件安装失败，请手动执行")) {
							reject("插件安装失败，请手动执行");
						}
					},
					(err: string) => {
						logger.error(`WeChat install error: ${err}`);
						reject(err);
					},
					() => {
						resolve(false);
					},
				);
			});
		} catch (e) {
			logger.error("Failed to start WeChat install flow:", e);
			return false;
		} finally {
			if (timer) {
				clearTimeout(timer);
			}
		}
	}
}

export default WeChatChannel;
