<script lang="ts">
	import { onMount } from "svelte";
	import { pluginState } from "$lib/stores/plugin-state.svelte";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Badge } from "$lib/components/ui/badge";
	import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle,
	} from "$lib/components/ui/dialog";
	import { Label } from "$lib/components/ui/label";
	import type { InstalledPlugin } from "@shared/types";

	onMount(async () => {
		await pluginState.initialize();
	});

	let searchQuery = $state("");
	let activeTab = $state("installed");
	let settingsDialogOpen = $state(false);
	let selectedPlugin = $state<InstalledPlugin | null>(null);
	let pluginConfig = $state<Record<string, unknown>>({});

	const { installedPlugins, builtinPlugins, thirdPartyPlugins, isLoading, error } =
		$derived(pluginState);

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
		try {
			await pluginState.refreshPlugins();
		} catch (err) {
			console.error("Failed to refresh plugins:", err);
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
			pluginConfig = {};
		}
		settingsDialogOpen = true;
	}

	async function saveSettings() {
		if (!selectedPlugin) return;

		try {
			await pluginState.setPluginConfig(selectedPlugin.metadata.id, pluginConfig);
			settingsDialogOpen = false;
		} catch (err) {
			console.error("Failed to save plugin config:", err);
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
</script>

<div class="flex h-full flex-col gap-6 p-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Plugins</h1>
			<p class="text-muted-foreground mt-1">Extend functionality with plugins</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" size="sm" onclick={handleRefresh} disabled={isLoading}>
				{isLoading ? "⟳" : "↻"} Refresh
			</Button>
			<Button variant="default" size="sm">+ Install Plugin</Button>
		</div>
	</div>

	<!-- Search -->
	<div class="relative">
		<span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
		<Input type="text" placeholder="Search plugins..." bind:value={searchQuery} class="pl-10" />
	</div>

	<!-- Error message -->
	{#if error}
		<div class="rounded-lg bg-destructive/10 p-4 text-destructive">
			<p class="font-medium">Error</p>
			<p class="text-sm">{error}</p>
		</div>
	{/if}

	<!-- Tabs -->
	<Tabs bind:value={activeTab} class="flex-1">
		<TabsList class="grid w-full grid-cols-3">
			<TabsTrigger value="installed">
				All ({installedPlugins.length})
			</TabsTrigger>
			<TabsTrigger value="builtin">
				Built-in ({builtinPlugins.length})
			</TabsTrigger>
			<TabsTrigger value="thirdparty">
				Third-party ({thirdPartyPlugins.length})
			</TabsTrigger>
		</TabsList>

		<TabsContent value={activeTab} class="mt-6">
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<div class="text-center">
						<div class="mx-auto mb-4 text-4xl">⟳</div>
						<p class="text-muted-foreground">Loading plugins...</p>
					</div>
				</div>
			{:else if filteredPlugins.length === 0}
				<div class="flex items-center justify-center py-12">
					<div class="text-center">
						<p class="text-muted-foreground mb-2">No plugins found</p>
						{#if searchQuery}
							<p class="text-sm text-muted-foreground">Try adjusting your search query</p>
						{/if}
					</div>
				</div>
			{:else}
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each filteredPlugins as plugin (plugin.metadata.id)}
						<div
							class="group relative rounded-lg border p-4 transition-all hover:border-primary hover:shadow-md"
						>
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
									<div>
										<h3 class="font-semibold">{plugin.metadata.name}</h3>
										<p class="text-xs text-muted-foreground">v{plugin.metadata.version}</p>
									</div>
								</div>
								<Badge variant={getStatusBadgeVariant(plugin.status)}>
									{plugin.status}
								</Badge>
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
								by {plugin.metadata.author}
							</p>

							<!-- Actions -->
							<div class="flex gap-2">
								{#if plugin.status === "enabled"}
									<Button
										size="sm"
										variant="outline"
										class="flex-1"
										onclick={() => pluginState.disablePlugin(plugin.metadata.id)}
									>
										Disable
									</Button>
								{:else if plugin.status === "disabled"}
									<Button
										size="sm"
										variant="default"
										class="flex-1"
										onclick={() => pluginState.enablePlugin(plugin.metadata.id)}
									>
										Enable
									</Button>
								{/if}
								<Button size="sm" variant="ghost" onclick={() => openSettings(plugin)}>
									Settings
								</Button>
							</div>

							<!-- Builtin badge -->
							{#if plugin.metadata.builtin}
								<div class="absolute right-2 top-2">
									<Badge variant="secondary" class="text-xs">Built-in</Badge>
								</div>
							{/if}
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
			<DialogTitle>{selectedPlugin?.metadata.name} Settings</DialogTitle>
			<DialogDescription>
				Configure {selectedPlugin?.metadata.name} plugin settings
			</DialogDescription>
		</DialogHeader>

		{#if selectedPlugin}
			<div class="space-y-4 py-4">
				<!-- Plugin Info -->
				<div class="rounded-lg bg-muted p-4">
					<p class="text-sm"><strong>Version:</strong> {selectedPlugin.metadata.version}</p>
					<p class="text-sm"><strong>Author:</strong> {selectedPlugin.metadata.author}</p>
					<p class="text-sm mt-2">{selectedPlugin.metadata.description}</p>
				</div>

				<!-- Configuration Fields -->
				<div class="space-y-4">
					<h3 class="text-sm font-medium">Configuration</h3>

					{#if selectedPlugin.metadata.configSchema?.properties}
						{#each Object.entries(selectedPlugin.metadata.configSchema.properties) as [key, schema]}
							<div class="space-y-2">
								<Label for={key} class="text-sm font-medium">
									{schema.title || key}
									{#if Array.isArray(selectedPlugin.metadata.configSchema.required) && selectedPlugin.metadata.configSchema.required.includes(key)}
										<span class="text-destructive">*</span>
									{/if}
								</Label>
								{#if schema.description}
									<p class="text-xs text-muted-foreground">{schema.description}</p>
								{/if}

								<!-- Render different input types based on schema type -->
								{#if schema.type === "boolean"}
									<div class="flex items-center space-x-2">
										<input
											id={key}
											type="checkbox"
											checked={!!pluginConfig[key]}
											onchange={(e) => (pluginConfig[key] = e.currentTarget.checked)}
											class="h-4 w-4 rounded border-gray-300"
										/>
										<label for={key} class="text-sm">
											{schema.description || "Enable"}
										</label>
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
						<p class="text-sm text-muted-foreground">No configuration options available</p>
					{/if}
				</div>
			</div>

			<DialogFooter>
				<Button variant="outline" onclick={() => (settingsDialogOpen = false)}>Cancel</Button>
				<Button onclick={saveSettings}>Save Changes</Button>
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>
