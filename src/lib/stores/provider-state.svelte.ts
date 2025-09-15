import { DEFAULT_PROVIDERS } from "$lib/datas/providers.js";
import type { ModelProvider } from "$lib/types/provider.js";
import type { Model, ModelCreateInput, ModelUpdateInput } from "$lib/types/model.js";
import { nanoid } from "nanoid";
import { getModelsByProvider, getAllModels } from "$lib/api/models.js";
import { toast } from "svelte-sonner";
import { m } from "$lib/paraglide/messages.js";

class ProviderState {
	providers = $state<ModelProvider[]>([]);
	models = $state<Model[]>([]);

	constructor() {
		this.loadFromStorage();
	}
	private loadFromStorage() {
		const storedProviders = localStorage.getItem("ai-studio-providers");
		if (storedProviders) {
			try {
				this.providers = JSON.parse(storedProviders);
			} catch {
				this.providers = [...DEFAULT_PROVIDERS];
			}
		} else {
			this.providers = [...DEFAULT_PROVIDERS];
		}

		const storedModels = localStorage.getItem("ai-studio-models");
		if (storedModels) {
			try {
				const parsedModels = JSON.parse(storedModels);

				this.models = parsedModels.map((model: { capabilities: string[] }) => ({
					...model,
					capabilities: new Set(model.capabilities || []),
				}));
			} catch {
				this.models = [];
			}
		} else {
			this.models = [];
		}
	}
	private saveToStorage() {
		localStorage.setItem("ai-studio-providers", JSON.stringify(this.providers));
		const modelsForStorage = this.models.map((model) => ({
			...model,
			capabilities: Array.from(model.capabilities),
		}));
		localStorage.setItem("ai-studio-models", JSON.stringify(modelsForStorage));
	}
	getProvider(id: string): ModelProvider | undefined {
		return this.providers.find((p) => p.id === id);
	}
	getProviderByNameOrId(nameOrId: string): ModelProvider | undefined {
		return this.providers.find((p) => p.name === nameOrId || p.id === nameOrId);
	}
	addProvider(provider: ModelProvider) {
		this.providers = [...this.providers, provider];
		this.saveToStorage();
	}
	updateProvider(id: string, updates: Partial<ModelProvider>) {
		this.providers = this.providers.map((p) => (p.id === id ? { ...p, ...updates } : p));
		this.saveToStorage();
	}
	removeProvider(id: string) {
		this.providers = this.providers.filter((p) => p.id !== id);
		this.saveToStorage();
	}
	reorderProviders(newOrder: ModelProvider[]) {
		this.providers = [...newOrder];
		this.saveToStorage();
	}
	createCustomProvider(name: string = "自定义提供商"): ModelProvider {
		const timestamp = Date.now();
		return {
			id: `custom-${timestamp}`,
			name,
			apiType: "openai",
			apiKey: "",
			baseUrl: "",
			enabled: true,
			custom: true,
			status: "pending",
			websites: {
				official: "",
				apiKey: "",
				docs: "",
				models: "",
				defaultBaseUrl: "",
			},
			icon: undefined,
		};
	}
	resetToDefaults() {
		this.providers = [...DEFAULT_PROVIDERS];
		this.saveToStorage();
	}
	searchModelsByName(name: string): Model[] {
		return this.models.filter((m) => m.name.toLowerCase().includes(name.toLowerCase()));
	}
	getSortedModels(): Model[] {
		return [...this.models].sort((a, b) => a.name.localeCompare(b.name));
	}
	getSortedModelsByProvider(providerId: string): Model[] {
		return this.models
			.filter((m) => m.providerId === providerId)
			.sort((a, b) => a.name.localeCompare(b.name));
	}
	addModel(input: ModelCreateInput): Model {
		if (!input.id || !input.id.trim()) {
			throw new Error("Model ID is required and cannot be empty");
		}

		const existingModel = this.models.find((m) => m.id === input.id);
		if (existingModel) {
			throw new Error(`Model with ID "${input.id}" already exists`);
		}

		const model: Model = {
			id: input.id,
			name: input.name,
			remark: input.remark || "",
			providerId: input.providerId,
			capabilities: input.capabilities || new Set(),
			type: input.type || "language",
			custom: input.custom || false,
			enabled: input.enabled ?? true,
			collected: input.collected || false,
		};
		this.models = [...this.models, model];
		this.saveToStorage();
		return model;
	}
	updateModel(id: string, updates: ModelUpdateInput): boolean {
		const modelIndex = this.models.findIndex((m) => m.id === id);
		if (modelIndex === -1) return false;

		if (updates.id && updates.id !== id) {
			const existingModel = this.models.find((m) => m.id === updates.id);
			if (existingModel) {
				console.warn(`Model with ID "${updates.id}" already exists`);
				return false;
			}
		}

		this.models = this.models.map((m) => (m.id === id ? { ...m, ...updates } : m));
		this.saveToStorage();
		return true;
	}
	removeModel(id: string): boolean {
		const originalLength = this.models.length;
		this.models = this.models.filter((m) => m.id !== id);
		if (this.models.length !== originalLength) {
			this.saveToStorage();
			return true;
		}
		return false;
	}
	addModels(models: ModelCreateInput[]): Model[] {
		const newModels: Model[] = models.map((input) => ({
			id: nanoid(),
			name: input.name,
			remark: input.remark || "",
			providerId: input.providerId,
			capabilities: input.capabilities || new Set(),
			type: input.type || "language",
			custom: input.custom || false,
			enabled: input.enabled ?? true,
			collected: input.collected || false,
		}));
		this.models = [...this.models, ...newModels];
		this.saveToStorage();
		return newModels;
	}
	toggleModelCollected(id: string): boolean {
		const model = this.models.find((m) => m.id === id);
		if (!model) return false;

		this.models = this.models.map((m) => (m.id === id ? { ...m, collected: !m.collected } : m));
		this.saveToStorage();
		return true;
	}
	toggleModelEnabled(id: string): boolean {
		const model = this.models.find((m) => m.id === id);
		if (!model) return false;

		this.models = this.models.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m));
		this.saveToStorage();
		return true;
	}
	removeModelsByProvider(providerId: string): number {
		const originalLength = this.models.length;
		this.models = this.models.filter((m) => m.providerId !== providerId);
		const removedCount = originalLength - this.models.length;
		if (removedCount > 0) {
			this.saveToStorage();
		}
		return removedCount;
	}
	clearModelsByProvider(providerId: string): number {
		return this.removeModelsByProvider(providerId);
	}
	async fetchModelsForProvider(provider: ModelProvider): Promise<boolean> {
		try {
			const result = await getModelsByProvider(provider);
			if (result.success && result.data) {
				this.updateProvider(provider.id, { status: "connected" });
				this.removeModelsByProvider(provider.id);
				this.models = [...this.models, ...result.data.models];
				this.saveToStorage();
				toast.success(
					m.text_fetch_models_success({
						count: result.data.models.length.toString(),
						provider: provider.name,
					}),
				);
				return true;
			} else {
				this.updateProvider(provider.id, { status: "error" });
				toast.error(m.text_fetch_models_error({ provider: provider.name }), {
					description: result.error || m.text_fetch_models_unknown_error(),
				});
				return false;
			}
		} catch (error) {
			console.error(`Failed to fetch models for provider ${provider.id}:`, error);
			this.updateProvider(provider.id, { status: "error" });
			toast.error(m.text_fetch_models_error({ provider: provider.name }), {
				description: error instanceof Error ? error.message : m.text_fetch_models_network_error(),
			});
			return false;
		}
	}
	async fetchAllModels(): Promise<boolean> {
		try {
			const result = await getAllModels(this.providers);
			if (result.success && result.data) {
				this.models = result.data.models;
				this.saveToStorage();
				return true;
			}
			return false;
		} catch (error) {
			console.error("Failed to fetch all models:", error);
			return false;
		}
	}
	async refreshProviderModels(providerId: string): Promise<boolean> {
		const provider = this.getProvider(providerId);
		if (!provider) return false;

		return await this.fetchModelsForProvider(provider);
	}
}

export const providerState = new ProviderState();
