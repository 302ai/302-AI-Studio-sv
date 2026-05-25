import { createLogger } from "@shared/logger";
import http from "http";
import net from "net";
import { URL } from "url";
import { generalSettingsStorage } from "../storage-service/general-settings-storage";

const logger = createLogger("services");

/**
 * Proxy Forward Service
 *
 * This service runs a local HTTP proxy server that forwards requests based on user's proxy settings.
 * - If proxy is enabled: forwards to user's configured proxy
 * - If proxy is disabled: forwards directly to target server
 *
 * This allows containers to use a fixed proxy address (http://host.docker.internal:18890)
 * without needing to restart when proxy settings change.
 */
export class ProxyForwardService {
	private server: http.Server | null = null;
	private port: number = 18890; // Fixed port for container proxy
	private isRunning: boolean = false;

	/**
	 * Start the proxy forward service
	 */
	async start(): Promise<void> {
		if (this.isRunning) {
			logger.warn("[ProxyForward] Service already running");
			return;
		}

		try {
			// Check if port is available
			const portAvailable = await this.isPortAvailable(this.port);
			if (!portAvailable) {
				// Try to find an available port in range 18890-18899
				const availablePort = await this.findAvailablePort(18890, 18899);
				if (availablePort) {
					this.port = availablePort;
					logger.info(`[ProxyForward] Port 18890 occupied, using ${this.port} instead`);
				} else {
					throw new Error("No available port in range 18890-18899");
				}
			}

			this.server = http.createServer(this.handleRequest.bind(this));

			// Handle CONNECT method for HTTPS
			this.server.on("connect", this.handleConnect.bind(this));

			// Handle server errors
			this.server.on("error", (error) => {
				logger.error("[ProxyForward] Server error:", error);
			});

			return new Promise((resolve, reject) => {
				this.server!.listen(this.port, "127.0.0.1", () => {
					this.isRunning = true;
					logger.info(`[ProxyForward] Service started on 127.0.0.1:${this.port}`);
					resolve();
				});

				this.server!.on("error", (error) => {
					this.isRunning = false;
					reject(error);
				});
			});
		} catch (error) {
			logger.error("[ProxyForward] Failed to start service:", error);
			throw error;
		}
	}

	/**
	 * Stop the proxy forward service
	 */
	async stop(): Promise<void> {
		if (!this.server || !this.isRunning) {
			return;
		}

		return new Promise((resolve) => {
			this.server!.close(() => {
				this.isRunning = false;
				logger.info("[ProxyForward] Service stopped");
				this.server = null;
				resolve();
			});
		});
	}

	/**
	 * Get the port number the service is running on
	 */
	getPort(): number {
		return this.port;
	}

	/**
	 * Check if the service is running
	 */
	isServiceRunning(): boolean {
		return this.isRunning;
	}

	/**
	 * Handle HTTP requests
	 */
	private async handleRequest(
		clientReq: http.IncomingMessage,
		clientRes: http.ServerResponse,
	): Promise<void> {
		try {
			const proxySettings = await generalSettingsStorage.getProxySettings();

			if (proxySettings.enabled && proxySettings.host && proxySettings.port) {
				// Proxy enabled: forward to user's configured proxy
				logger.debug(
					`[ProxyForward] Forwarding HTTP request to proxy: ${proxySettings.host}:${proxySettings.port}`,
				);
				this.forwardToProxy(clientReq, clientRes, proxySettings);
			} else {
				// Proxy disabled: forward directly to target server
				logger.debug("[ProxyForward] Forwarding HTTP request directly");
				this.forwardDirect(clientReq, clientRes);
			}
		} catch (error) {
			logger.error("[ProxyForward] Error handling request:", error);
			clientRes.writeHead(500);
			clientRes.end("Internal Proxy Error");
		}
	}

	/**
	 * Handle HTTPS CONNECT requests
	 */
	private async handleConnect(
		req: http.IncomingMessage,
		clientSocket: net.Socket,
		head: Buffer,
	): Promise<void> {
		try {
			const proxySettings = await generalSettingsStorage.getProxySettings();

			if (proxySettings.enabled && proxySettings.host && proxySettings.port) {
				// Proxy enabled: connect through user's configured proxy
				logger.debug(
					`[ProxyForward] Forwarding HTTPS CONNECT to proxy: ${proxySettings.host}:${proxySettings.port}`,
				);
				this.connectToProxy(req, clientSocket, head, proxySettings);
			} else {
				// Proxy disabled: connect directly to target server
				logger.debug("[ProxyForward] Forwarding HTTPS CONNECT directly");
				this.connectDirect(req, clientSocket, head);
			}
		} catch (error) {
			logger.error("[ProxyForward] Error handling CONNECT:", error);
			clientSocket.end("HTTP/1.1 500 Internal Proxy Error\r\n\r\n");
		}
	}

	/**
	 * Forward HTTP request to user's configured proxy
	 */
	private forwardToProxy(
		clientReq: http.IncomingMessage,
		clientRes: http.ServerResponse,
		proxySettings: { host: string; port: number },
	): void {
		const options = {
			hostname: proxySettings.host,
			port: proxySettings.port,
			path: clientReq.url,
			method: clientReq.method,
			headers: clientReq.headers,
		};

		const proxyReq = http.request(options, (proxyRes) => {
			clientRes.writeHead(proxyRes.statusCode!, proxyRes.headers);
			proxyRes.pipe(clientRes);
		});

		proxyReq.on("error", (error) => {
			logger.error("[ProxyForward] Proxy request error:", error);
			clientRes.writeHead(502);
			clientRes.end("Bad Gateway: Proxy Error");
		});

		clientReq.pipe(proxyReq);
	}

	/**
	 * Forward HTTP request directly to target server
	 */
	private forwardDirect(clientReq: http.IncomingMessage, clientRes: http.ServerResponse): void {
		try {
			const url = new URL(clientReq.url!, `http://${clientReq.headers.host}`);

			const options = {
				hostname: url.hostname,
				port: url.port || 80,
				path: url.pathname + url.search,
				method: clientReq.method,
				headers: clientReq.headers,
			};

			const targetReq = http.request(options, (targetRes) => {
				clientRes.writeHead(targetRes.statusCode!, targetRes.headers);
				targetRes.pipe(clientRes);
			});

			targetReq.on("error", (error) => {
				logger.error("[ProxyForward] Direct request error:", error);
				clientRes.writeHead(502);
				clientRes.end("Bad Gateway: Connection Error");
			});

			clientReq.pipe(targetReq);
		} catch (error) {
			logger.error("[ProxyForward] Error parsing request URL:", error);
			clientRes.writeHead(400);
			clientRes.end("Bad Request");
		}
	}

	/**
	 * Connect to target through user's configured proxy (HTTPS)
	 */
	private connectToProxy(
		req: http.IncomingMessage,
		clientSocket: net.Socket,
		head: Buffer,
		proxySettings: { host: string; port: number },
	): void {
		const proxySocket = net.connect(proxySettings.port, proxySettings.host, () => {
			// Send CONNECT request to proxy
			proxySocket.write(
				`CONNECT ${req.url} HTTP/${req.httpVersion}\r\n` +
					Object.keys(req.headers)
						.map((key) => `${key}: ${req.headers[key]}`)
						.join("\r\n") +
					"\r\n\r\n",
			);
		});

		// Wait for proxy response
		let isConnected = false;
		proxySocket.once("data", (data) => {
			const response = data.toString();
			if (response.includes("200")) {
				// Connection established
				isConnected = true;
				clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");

				// Pipe data between client and proxy
				proxySocket.write(head);
				proxySocket.pipe(clientSocket);
				clientSocket.pipe(proxySocket);
			} else {
				// Connection failed
				logger.error("[ProxyForward] Proxy CONNECT failed:", response);
				clientSocket.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
				proxySocket.end();
			}
		});

		proxySocket.on("error", (error) => {
			if (!isConnected) {
				logger.error("[ProxyForward] Proxy connect error:", error);
				clientSocket.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
			}
		});

		clientSocket.on("error", (error) => {
			logger.error("[ProxyForward] Client socket error:", error);
			proxySocket.end();
		});
	}

	/**
	 * Connect directly to target server (HTTPS)
	 */
	private connectDirect(req: http.IncomingMessage, clientSocket: net.Socket, head: Buffer): void {
		try {
			const [hostname, portStr] = req.url!.split(":");
			const port = parseInt(portStr) || 443;

			const targetSocket = net.connect(port, hostname, () => {
				clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
				targetSocket.write(head);
				targetSocket.pipe(clientSocket);
				clientSocket.pipe(targetSocket);
			});

			targetSocket.on("error", (error) => {
				logger.error("[ProxyForward] Direct connect error:", error);
				clientSocket.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
			});

			clientSocket.on("error", (error) => {
				logger.error("[ProxyForward] Client socket error:", error);
				targetSocket.end();
			});
		} catch (error) {
			logger.error("[ProxyForward] Error parsing CONNECT URL:", error);
			clientSocket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
		}
	}

	/**
	 * Check if a port is available
	 */
	private async isPortAvailable(port: number): Promise<boolean> {
		return new Promise((resolve) => {
			const server = net.createServer();

			server.once("error", () => {
				resolve(false);
			});

			server.once("listening", () => {
				server.close();
				resolve(true);
			});

			server.listen(port, "127.0.0.1");
		});
	}

	/**
	 * Find an available port in the given range
	 */
	private async findAvailablePort(start: number, end: number): Promise<number | null> {
		for (let port = start; port <= end; port++) {
			if (await this.isPortAvailable(port)) {
				return port;
			}
		}
		return null;
	}
}

export const proxyForwardService = new ProxyForwardService();
