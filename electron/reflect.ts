/* eslint-disable @typescript-eslint/no-explicit-any */
import "reflect-metadata";

// Define a metadata to collect all metadata
const _metadata = {};

export function ServiceRegister(serviceName: string) {
	return (target: any) => {
		const targetName = target.name;

		const data = {
			service: serviceName,
			...Reflect.getMetadata(`${targetName}`, _metadata),
		};

		Reflect.defineMetadata(`${targetName}`, data, _metadata);
	};
}

export function ServiceHandler() {
	return (target: any, methodName: string, descriptor: PropertyDescriptor) => {
		const targetName = target.constructor.name;

		const existingMetadata = Reflect.getMetadata(`${targetName}`, _metadata) || {};

		if (!existingMetadata.handlers) {
			existingMetadata.handlers = {};
		}

		existingMetadata.handlers[methodName] = {
			handle: descriptor.value,
		};

		Reflect.defineMetadata(`${targetName}`, existingMetadata, _metadata);
	};
}

export function getMetadata(className: string) {
	return Reflect.getMetadata(`${className}`, _metadata);
}
