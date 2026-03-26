/**
 *Description: wechat channel login
 *Author: Leessmin
 *Date: 2026-03-26
 **/

import type { OpenClawWeixinLoginMsg } from "@shared/types";
import { exec, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import * as readline from "node:readline";
import { promisify } from "node:util";
import { broadcastService } from "../broadcast-service";
class WeChatChannel {
	execAsync = promisify(exec);

	private commandProcess: ChildProcessWithoutNullStreams | null = null;
	private isConnecting = false;
	private isManual = false;

	private executeCommand = async (
		command: string,
		stdoutFn: (d: string) => void,
		closeFn?: (manual: boolean) => void,
	) => {
		try {
			if (this.commandProcess) {
				const old = this.commandProcess;
				if (!old.killed) {
					process.kill(-old.pid!, "SIGTERM");
					await once(old, "close");
					this.commandProcess = null;
					this.isManual = true;
				}
			}

			const proc = spawn("podman", ["exec", "-i", "local-cc-api", "bash", "-c", command], {
				detached: true,
			});
			this.commandProcess = proc;

			const rl = readline.createInterface({
				input: proc.stdout,
				crlfDelay: Infinity,
			});

			rl.on("line", stdoutFn);
			proc.once("close", (code) => {
				console.log(`openclaw: Child process exited with code ${code}`);
				rl.close();
				proc.stdout.removeAllListeners();
				proc.stderr.removeAllListeners();
				if (this.commandProcess === proc) {
					this.commandProcess = null;
					closeFn?.(this.isManual);
				}
				this.isManual = false;
			});
		} catch (error) {
			console.error("[OpenClawService] Failed to execute command:", error);
		}
	};

	private _hasOpenClawChannel = async (channelName: string) => {
		const { stdout } = await this.execAsync(
			'podman exec -i local-cc-api bash -c "openclaw channels list"',
		);

		return stdout.includes(channelName);
	};

	async connect() {
		// "openclaw channels login --channel openclaw-weixin"
		// "openclaw channels list"
		// npx -y @tencent-weixin/openclaw-weixin-cli install
		if (this.isConnecting) return;
		this.isConnecting = true;
		try {
			const has = await this._hasOpenClawChannel("openclaw-weixin");
			let command = "openclaw channels login --channel openclaw-weixin";
			if (!has) {
				command = "npx -y @tencent-weixin/openclaw-weixin-cli install";
				broadcastService.broadcastChannelToAll("openclaw-weixin:login", {
					type: "install",
					data: "",
				});
			}

			this.executeCommand(
				command,
				(line: string) => {
					console.log("openclaw-weixin:login:", line);
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
					} else if (line.includes("插件安装失败，请手动执行")) {
						data = {
							type: "error",
							data: line,
						};
					}

					broadcastService.broadcastChannelToAll("openclaw-weixin:login", data);
				},
				(manual: boolean) => {
					broadcastService.broadcastChannelToAll("openclaw-weixin:login", {
						type: "close",
						data: manual ? "manual" : "",
					});
				},
			);
		} catch (e) {
			console.error("openclaw-weixin:login:error", e);
		} finally {
			this.isConnecting = false;
		}
	}
}

export default WeChatChannel;
