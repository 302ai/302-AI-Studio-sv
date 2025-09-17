/* eslint-disable @typescript-eslint/no-explicit-any */
import "reflect-metadata";

const _metadata = {};

export function ServiceRegister(serviceName: string) {
	return (target: any) => {
		const targetName = target.name;

		const existingMetadata = Reflect.getMetadata(`${targetName}`, _metadata) || {};

		const data = {
			service: serviceName,
			handles: existingMetadata.handles || {},
			...existingMetadata,
		};

		Reflect.defineMetadata(`${targetName}`, data, _metadata);
	};
}

export function ServiceHandler() {
	return (target: any, methodName: string, descriptor: PropertyDescriptor) => {
		const targetName = target.constructor.name;

		const existingMetadata = Reflect.getMetadata(`${targetName}`, _metadata) || {};

		if (!existingMetadata.handles) {
			existingMetadata.handles = {};
		}

		existingMetadata.handles[methodName] = descriptor.value;

		Reflect.defineMetadata(`${targetName}`, existingMetadata, _metadata);
	};
}

export const getMetadata = (className: string) => Reflect.getMetadata(`${className}`, _metadata);
