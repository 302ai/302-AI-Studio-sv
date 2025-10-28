<script lang="ts">
	import { Badge } from "$lib/components/ui/badge";
	import { Button } from "$lib/components/ui/button";
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle,
	} from "$lib/components/ui/dialog";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
	import { Checkbox } from "$lib/components/ui/checkbox";
	import { m } from "$lib/paraglide/messages";
	import { pluginState } from "$lib/stores/plugin-state.svelte";
	import { Loader2, Plus, RefreshCw, Search } from "@lucide/svelte";
	import type { InstalledPlugin } from "@shared/types";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";

	onMount(async () => {
		await pluginState.initialize();
		// Check for errors after initialization
		if (pluginState.error) {
			toast.error(m.plugins_error(), {
				description: pluginState.error,
			});
		}
	});

	let searchQuery = $state("");
	let activeTab = $state("installed");
	let settingsDialogOpen = $state(false);
	let selectedPlugin = $state<InstalledPlugin | null>(null);
	let pluginConfig = $state<Record<string, unknown>>({});

	const { installedPlugins, builtinPlugins, thirdPartyPlugins, isLoading } = $derived(pluginState);

	// Filter plugins based on search query
	const filteredPlugins = $derived.by(() => {
		const plugins =
			activeTab === "builtin"
				? builtinPlugins
				: activeTab === "thirdparty"
					? thirdPartyPlugins
					: installedPlugins;

		if (!searchQuery.trim()) return plugins;

		const query = searchQuery.toLowerCase();
		return plugins.filter(
			(p) =>
				p.metadata.name.toLowerCase().includes(query) ||
				p.metadata.description.toLowerCase().includes(query) ||
				p.metadata.tags?.some((t) => t.toLowerCase().includes(query)),
		);
	});

	async function handleRefresh() {
		await pluginState.refreshPlugins();
		// Check for errors after refresh
		if (pluginState.error) {
			toast.error(m.plugins_error(), {
				description: pluginState.error,
			});
		}
	}

	async function openSettings(plugin: InstalledPlugin) {
		selectedPlugin = plugin;
		// Load current config
		try {
			const config = await pluginState.getPluginConfig(plugin.metadata.id);
			pluginConfig = config || {};
		} catch (err) {
			console.error("Failed to load plugin config:", err);
			toast.error(m.plugins_error(), {
				description: err instanceof Error ? err.message : String(err),
			});
			pluginConfig = {};
		}
		settingsDialogOpen = true;
	}

	async function saveSettings() {
		if (!selectedPlugin) return;

		try {
			await pluginState.setPluginConfig(selectedPlugin.metadata.id, pluginConfig);
			settingsDialogOpen = false;
			toast.success(m.plugins_settings_saved());
		} catch (err) {
			console.error("Failed to save plugin config:", err);
			toast.error(m.plugins_error(), {
				description: err instanceof Error ? err.message : String(err),
			});
		}
	}

	async function handleEnablePlugin(pluginId: string) {
		try {
			await pluginState.enablePlugin(pluginId);
		} catch (err) {
			console.error("Failed to enable plugin:", err);
			toast.error(m.plugins_error(), {
				description: err instanceof Error ? err.message : String(err),
			});
		}
	}

	async function handleDisablePlugin(pluginId: string) {
		try {
			await pluginState.disablePlugin(pluginId);
		} catch (err) {
			console.error("Failed to disable plugin:", err);
			toast.error(m.plugins_error(), {
				description: err instanceof Error ? err.message : String(err),
			});
		}
	}

	function getStatusBadgeVariant(status: string) {
		switch (status) {
			case "enabled":
				return "default";
			case "disabled":
				return "secondary";
			case "error":
				return "destructive";
			default:
				return "outline";
		}
	}

	function getStatusText(status: string) {
		switch (status) {
			case "enabled":
				return m.plugins_status_enabled();
			case "disabled":
				return m.plugins_status_disabled();
			case "error":
				return m.plugins_status_error();
			default:
				return status;
		}
	}
</script>

<div class="flex h-full flex-col gap-6 p-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">{m.plugins_title()}</h1>
			<p class="text-muted-foreground mt-1">{m.plugins_description()}</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" size="sm" onclick={handleRefresh} disabled={isLoading}>
				<RefreshCw class={isLoading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
				{m.plugins_refresh()}
			</Button>
			<Button variant="default" size="sm">
				<Plus class="mr-2 h-4 w-4" />
				{m.plugins_install()}
			</Button>
		</div>
	</div>

	<!-- Search -->
	<div class="relative">
		<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
		<Input
			type="text"
			placeholder={m.plugins_search_placeholder()}
			bind:value={searchQuery}
			class="pl-10"
		/>
	</div>

	<!-- Tabs -->
	<Tabs bind:value={activeTab} class="flex-1">
		<TabsList class="grid w-full grid-cols-3">
			<TabsTrigger value="installed">
				{m.plugins_tab_all()} ({installedPlugins.length})
			</TabsTrigger>
			<TabsTrigger value="builtin">
				{m.plugins_tab_builtin()} ({builtinPlugins.length})
			</TabsTrigger>
			<TabsTrigger value="thirdparty">
				{m.plugins_tab_thirdparty()} ({thirdPartyPlugins.length})
			</TabsTrigger>
		</TabsList>

		<TabsContent value={activeTab} class="mt-6">
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<div class="text-center">
						<Loader2 class="mx-auto mb-4 h-10 w-10 animate-spin text-muted-foreground" />
						<p class="text-muted-foreground">{m.plugins_loading()}</p>
					</div>
				</div>
			{:else if filteredPlugins.length === 0}
				<div class="flex items-center justify-center py-12">
					<div class="text-center">
						<p class="text-muted-foreground mb-2">{m.plugins_no_plugins_found()}</p>
						{#if searchQuery}
							<p class="text-sm text-muted-foreground">{m.plugins_search_tip()}</p>
						{/if}
					</div>
				</div>
			{:else}
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each filteredPlugins as plugin (plugin.metadata.id)}
						<div
							class="group relative rounded-lg border p-4 transition-all hover:border-primary hover:shadow-md"
						>
							<!-- Builtin badge - moved to top right corner -->
							{#if plugin.metadata.builtin}
								<div class="absolute right-2 top-2">
									<Badge variant="secondary" class="text-xs">{m.plugins_badge_builtin()}</Badge>
								</div>
							{/if}

							<!-- Plugin icon and header -->
							<div class="mb-3 flex items-start justify-between">
								<div class="flex items-center gap-3">
									{#if plugin.metadata.icon}
										<img
											src={plugin.metadata.icon}
											alt={plugin.metadata.name}
											class="h-10 w-10 rounded"
										/>
									{:else}
										<div
											class="flex h-10 w-10 items-center justify-center rounded bg-primary/10 text-primary"
										>
											<span class="text-lg font-bold">
												{plugin.metadata.name.charAt(0).toUpperCase()}
											</span>
										</div>
									{/if}
									<div class="flex-1">
										<h3 class="font-semibold">{plugin.metadata.name}</h3>
										<div class="flex items-center gap-2">
											<p class="text-xs text-muted-foreground">v{plugin.metadata.version}</p>
											<Badge variant={getStatusBadgeVariant(plugin.status)} class="text-xs">
												{getStatusText(plugin.status)}
											</Badge>
										</div>
									</div>
								</div>
							</div>

							<!-- Description -->
							<p class="mb-3 text-sm text-muted-foreground line-clamp-2">
								{plugin.metadata.description}
							</p>

							<!-- Tags -->
							{#if plugin.metadata.tags && plugin.metadata.tags.length > 0}
								<div class="mb-3 flex flex-wrap gap-1">
									{#each plugin.metadata.tags.slice(0, 3) as tag}
										<Badge variant="outline" class="text-xs">
											{tag}
										</Badge>
									{/each}
								</div>
							{/if}

							<!-- Author -->
							<p class="text-xs text-muted-foreground mb-3">
								{m.plugins_author_by()}
								{plugin.metadata.author}
							</p>

							<!-- Actions -->
							<div class="flex gap-2">
								{#if plugin.status === "enabled"}
									<Button
										size="sm"
										variant="outline"
										class="flex-1"
										onclick={() => handleDisablePlugin(plugin.metadata.id)}
									>
										{m.plugins_button_disable()}
									</Button>
								{:else if plugin.status === "disabled"}
									<Button
										size="sm"
										variant="default"
										class="flex-1"
										onclick={() => handleEnablePlugin(plugin.metadata.id)}
									>
										{m.plugins_button_enable()}
									</Button>
								{/if}
								<Button size="sm" variant="ghost" onclick={() => openSettings(plugin)}>
									{m.plugins_button_settings()}
								</Button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</TabsContent>
	</Tabs>
</div>

<!-- Plugin Settings Dialog -->
<Dialog bind:open={settingsDialogOpen}>
	<DialogContent class="max-w-2xl max-h-[80vh] overflow-y-auto">
		<DialogHeader>
			<DialogTitle
				>{m.plugins_settings_title({ name: selectedPlugin?.metadata.name || "" })}</DialogTitle
			>
			<DialogDescription>
				{m.plugins_settings_description({ name: selectedPlugin?.metadata.name || "" })}
			</DialogDescription>
		</DialogHeader>

		{#if selectedPlugin}
			<div class="space-y-4 py-4">
				<!-- Plugin Info -->
				<div class="rounded-lg bg-muted p-4">
					<p class="text-sm">
						<strong>{m.plugins_settings_version()}</strong>
						{selectedPlugin.metadata.version}
					</p>
					<p class="text-sm">
						<strong>{m.plugins_settings_author()}</strong>
						{selectedPlugin.metadata.author}
					</p>
					<p class="text-sm mt-2">{selectedPlugin.metadata.description}</p>
				</div>

				<!-- Configuration Fields -->
				<div class="space-y-4">
					<h3 class="text-sm font-medium">{m.plugins_settings_configuration()}</h3>

					{#if selectedPlugin.metadata.configSchema?.properties}
						{#each Object.entries(selectedPlugin.metadata.configSchema.properties) as [key, schema]}
							<div class="space-y-2">
								<Label for={key} class="text-sm font-medium">
									{schema.title || key}
									{#if Array.isArray(selectedPlugin.metadata.configSchema.required) && selectedPlugin.metadata.configSchema.required.includes(key)}
										<span class="text-destructive">{m.plugins_settings_required()}</span>
									{/if}
								</Label>
								{#if schema.description}
									<p class="text-xs text-muted-foreground">{schema.description}</p>
								{/if}

								<!-- Render different input types based on schema type -->
								{#if schema.type === "boolean"}
									<div class="flex items-center space-x-2">
										<Checkbox
											id={key}
											checked={!!pluginConfig[key]}
											onCheckedChange={(checked) => (pluginConfig[key] = checked)}
										/>
										<Label
											for={key}
											class="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
										>
											{schema.description || m.plugins_settings_enable_label()}
										</Label>
									</div>
								{:else if schema.enum && Array.isArray(schema.enum)}
									<select
										id={key}
										bind:value={pluginConfig[key]}
										class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
									>
										{#each schema.enum as option}
											<option value={option}>{option}</option>
										{/each}
									</select>
								{:else}
									<Input
										id={key}
										type={key.toLowerCase().includes("key") ||
										key.toLowerCase().includes("password")
											? "password"
											: "text"}
										bind:value={pluginConfig[key]}
										placeholder={schema.default || ""}
									/>
								{/if}
							</div>
						{/each}
					{:else}
						<p class="text-sm text-muted-foreground">{m.plugins_settings_no_config()}</p>
					{/if}
				</div>
			</div>

			<DialogFooter>
				<Button variant="outline" onclick={() => (settingsDialogOpen = false)}
					>{m.plugins_settings_cancel()}</Button
				>
				<Button onclick={saveSettings}>{m.plugins_settings_save()}</Button>
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>
