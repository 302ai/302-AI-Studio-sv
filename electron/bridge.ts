/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { ipcMain, ipcRenderer } from "electron";
import services from "./services";
import { getMetadata } from "./reflect";

export function initMainBridge(): void {
	services.forEach((ServiceClass) => {
		const service = new ServiceClass();
		const metadata = getMetadata(ServiceClass.name);
		if (!metadata) {
			console.warn(`No metadata found for service: ${ServiceClass.name}`);
			return;
		}

		const { service: name, handles } = metadata;
		if (!handles) {
			console.warn(`No handles found for service: ${name}`);
			return;
		}

		Object.entries(handles).forEach(([methodName, handle]) => {
			ipcMain.handle(
				`${name}:${methodName}`,
				(handle as (...args: any[]) => Promise<any> | any).bind(service),
			);
		});
	});
}

export function initPreloadBridge(): { [key: string]: Function } {
	const api: { [key: string]: any } = {};

	services.forEach((ServiceClass) => {
		const metadata = getMetadata(ServiceClass.name);
		if (!metadata) {
			console.warn(`No metadata found for service: ${ServiceClass.name}`);
			return;
		}

		const { service: name, handles } = metadata;
		if (!handles) {
			console.warn(`No handles found for service: ${name}`);
			return;
		}

		// Create object for service
		Reflect.set(api, `${name}`, {});

		// Transform handles to api
		Object.entries(handles).forEach(([methodName]) => {
			Reflect.set(api[name], `${methodName}`, (...args: any[]) => {
				return ipcRenderer.invoke(`${name}:${methodName}`, ...args);
			});
		});
	});

	return api;
}
