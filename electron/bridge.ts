/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ipcMain, ipcRenderer } from "electron";
import { services } from "./services/index";
import { getMetadata } from "./reflect";

export function initMainBridge(): void {
	services?.forEach((service) => {
		const metadata = getMetadata(service.constructor.name);
		if (!metadata) {
			console.warn(`No metadata found for service: ${service.constructor.name}`);
			return;
		}

		const { service: name, handlers } = metadata;
		if (!handlers) {
			console.warn(`No handlers found for service: ${name}`);
			return;
		}

		Object.entries(handlers).forEach(([methodName, handlerInfo]) => {
			const { handle } = handlerInfo as {
				handle: (...args: any[]) => Promise<any> | any;
			};

			ipcMain.handle(`${name}:${methodName}`, handle.bind(service));
		});
	});
}

export function initPreloadBridge(): { [key: string]: Function } {
	const api: { [key: string]: any } = {};

	services?.forEach((service) => {
		const metadata = getMetadata(service.constructor.name);
		const { service: name, handlers } = metadata;

		if (!handlers) {
			console.warn(`No handlers found for service: ${name}`);
			return;
		}

		// Create object for service
		Reflect.set(api, `${name}`, {});

		// Transform handlers to api
		Object.entries(handlers).forEach(([methodName]) => {
			Reflect.set(api[name], `${methodName}`, (...args: any[]) => {
				return ipcRenderer.invoke(`${name}:${methodName}`, ...args);
			});
		});
	});

	return api;
}
