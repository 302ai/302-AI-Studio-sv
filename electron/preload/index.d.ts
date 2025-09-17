declare global {
	interface Window {
		service: {
			attachmentsService: {
				openExternal: (url: string) => Promise<void>;
			};
		};
	}
}

export {};
