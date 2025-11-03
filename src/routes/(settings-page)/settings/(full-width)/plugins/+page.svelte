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
	import { marketplaceState } from "$lib/stores/marketplace-state.svelte";
	import { FolderOpen, Loader2, Plus, RefreshCw, Search, Download, Star } from "@lucide/svelte";
	import type { InstalledPlugin, PluginSource, PluginMarketEntry } from "@shared/types";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";

	onMount(async () => {
		await pluginState.initialize();
		await marketplaceState.initialize();
		// Check for errors after initialization
		if (pluginState.error) {
			toast.error(m.plugins_error(), {
				description: pluginState.error,
			});
		}
		if (marketplaceState.error) {
			toast.error(m.plugins_error(), {
				description: marketplaceState.error,
			});
		}
	});

	let searchQuery = $state("");
	let activeTab = $state("installed");
	let settingsDialogOpen = $state(false);
	let installDialogOpen = $state(false);
	let uninstallDialogOpen = $state(false);
	let detailsDialogOpen = $state(false);
	let marketplaceDetailsDialogOpen = $state(false);
	let selectedPlugin = $state<InstalledPlugin | null>(null);
	let selectedMarketplacePlugin = $state<PluginMarketEntry | null>(null);
	let pluginConfig = $state<Record<string, unknown>>({});
	let installSource = $state<"local" | "url" | "marketplace">("local");
	let installPath = $state("");
	let installUrl = $state("");
	let installMarketplaceId = $state("");
	let isInstalling = $state(false);
	let isUninstalling = $state(false);
	let updatingPlugins = $state(new Set<string>());

	const { installedPlugins, builtinPlugins, thirdPartyPlugins, isLoading } = $derived(pluginState);
	const { searchResults: marketplacePlugins, isLoading: isLoadingMarketplace } =
		$derived(marketplaceState);

	// Filter plugins based on search query
	const filteredPlugins = $derived.by(() => {
		// Skip filtering for marketplace tab
		if (activeTab === "marketplace") {
			return [];
		}

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
				p.metadata.tags?.some((t: string) => t.toLowerCase().includes(query)),
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

	function openInstallDialog() {
		installSource = "local";
		installPath = "";
		installUrl = "";
		installDialogOpen = true;
	}

	async function selectFolder() {
		try {
			const path = await window.electronAPI.pluginService.selectPluginFolder();
			if (path) {
				installPath = path;
			}
		} catch (err) {
			console.error("Failed to select folder:", err);
			toast.error(m.plugins_error(), {
				description: err instanceof Error ? err.message : String(err),
			});
		}
	}

	async function handleInstallPlugin() {
		if (isInstalling) return;

		let source: PluginSource;

		if (installSource === "local") {
			if (!installPath.trim()) {
				toast.error(m.plugins_install_error(), {
					description: m.plugins_install_path_placeholder(),
				});
				return;
			}
			source = { type: "local", path: installPath };
		} else if (installSource === "url") {
			if (!installUrl.trim()) {
				toast.error(m.plugins_install_error(), {
					description: m.plugins_install_url_placeholder(),
				});
				return;
			}
			source = { type: "url", url: installUrl };
		} else if (installSource === "marketplace") {
			if (!installMarketplaceId.trim()) {
				toast.error(m.plugins_install_error(), {
					description: m.plugins_marketplace_select_plugin(),
				});
				return;
			}
			source = { type: "marketplace", id: installMarketplaceId };
		} else {
			toast.error(m.plugins_error(), {
				description: "Unknown install source",
			});
			return;
		}

		isInstalling = true;

		try {
			await pluginState.installPlugin(source);
			toast.success(m.plugins_install_success());
			installDialogOpen = false;
			installPath = "";
			installUrl = "";
		} catch (err) {
			console.error("Failed to install plugin:", err);
			toast.error(m.plugins_install_error(), {
				description: err instanceof Error ? err.message : String(err),
			});
		} finally {
			isInstalling = false;
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

	function openDetails(plugin: InstalledPlugin) {
		selectedPlugin = plugin;
		detailsDialogOpen = true;
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

	function openUninstallDialog(plugin: InstalledPlugin) {
		selectedPlugin = plugin;
		uninstallDialogOpen = true;
	}

	async function handleUninstallPlugin() {
		if (!selectedPlugin || isUninstalling) return;

		isUninstalling = true;

		try {
			await pluginState.uninstallPlugin(selectedPlugin.metadata.id);
			toast.success(m.plugins_uninstall_success());
			uninstallDialogOpen = false;
			selectedPlugin = null;
		} catch (err) {
			console.error("Failed to uninstall plugin:", err);
			toast.error(m.plugins_error(), {
				description: err instanceof Error ? err.message : String(err),
			});
		} finally {
			isUninstalling = false;
		}
	}

	async function handleUpdatePlugin(pluginId: string) {
		if (updatingPlugins.has(pluginId)) return;

		updatingPlugins.add(pluginId);

		try {
			await pluginState.updatePlugin(pluginId);
			toast.success(m.plugins_settings_saved(), {
				description: "Plugin reloaded successfully",
			});
		} catch (err) {
			console.error("Failed to update plugin:", err);
			toast.error(m.plugins_error(), {
				description: err instanceof Error ? err.message : String(err),
			});
		} finally {
			updatingPlugins.delete(pluginId);
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

	// Marketplace functions
	function openMarketplaceDetails(plugin: PluginMarketEntry) {
		selectedMarketplacePlugin = plugin;
		marketplaceDetailsDialogOpen = true;
	}

	async function handleInstallFromMarketplace(pluginId: string) {
		if (isInstalling) return;

		// Check if already installed
		if (pluginState.isPluginInstalled(pluginId)) {
			toast.error(m.plugins_marketplace_plugin_already_installed());
			return;
		}

		isInstalling = true;

		try {
			const source: PluginSource = { type: "marketplace", id: pluginId };
			await pluginState.installPlugin(source);
			toast.success(m.plugins_install_success());

			// Close details dialog if open
			if (marketplaceDetailsDialogOpen) {
				marketplaceDetailsDialogOpen = false;
			}

			// Refresh plugin list
			await pluginState.refreshPlugins();
		} catch (err) {
			console.error("Failed to install from marketplace:", err);
			toast.error(m.plugins_install_error(), {
				description: err instanceof Error ? err.message : String(err),
			});
		} finally {
			isInstalling = false;
		}
	}

	async function handleMarketplaceSearch(query: string) {
		try {
			await marketplaceState.search(query);
		} catch (err) {
			console.error("Marketplace search failed:", err);
			toast.error(m.plugins_marketplace_search_failed(), {
				description: err instanceof Error ? err.message : String(err),
			});
		}
	}

	async function handleRefreshMarketplace() {
		try {
			await marketplaceState.refreshMarketplace(true);
			toast.success(m.plugins_marketplace_refreshed());
		} catch (err) {
			console.error("Failed to refresh marketplace:", err);
			toast.error(m.plugins_marketplace_refresh_failed(), {
				description: err instanceof Error ? err.message : String(err),
			});
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
			<Button variant="default" size="sm" onclick={openInstallDialog}>
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
			placeholder={activeTab === "marketplace"
				? m.plugins_marketplace_search_placeholder()
				: m.plugins_search_placeholder()}
			bind:value={searchQuery}
			oninput={() => {
				if (activeTab === "marketplace") {
					handleMarketplaceSearch(searchQuery);
				}
			}}
			class="pl-10"
		/>
	</div>

	<!-- Tabs -->
	<Tabs bind:value={activeTab} class="flex-1">
		<TabsList class="grid w-full grid-cols-4">
			<TabsTrigger value="installed">
				{m.plugins_tab_all()} ({installedPlugins.length})
			</TabsTrigger>
			<TabsTrigger value="builtin">
				{m.plugins_tab_builtin()} ({builtinPlugins.length})
			</TabsTrigger>
			<TabsTrigger value="thirdparty">
				{m.plugins_tab_thirdparty()} ({thirdPartyPlugins.length})
			</TabsTrigger>
			<TabsTrigger value="marketplace">
				{m.plugins_tab_marketplace()} ({marketplacePlugins.length})
			</TabsTrigger>
		</TabsList>

		<!-- Installed/Builtin/ThirdParty Tabs Content -->
		<TabsContent value="installed" class="mt-6">
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<div class="text-center">
						<RefreshCw class="mx-auto mb-4 h-10 w-10 animate-spin text-muted-foreground" />
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
									{#each plugin.metadata.tags.slice(0, 3) as tag (tag)}
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
							<div class="flex gap-2 flex-wrap">
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
								<Button size="sm" variant="ghost" onclick={() => openDetails(plugin)}>
									{m.plugins_button_details()}
								</Button>
								<Button size="sm" variant="ghost" onclick={() => openSettings(plugin)}>
									{m.plugins_button_settings()}
								</Button>
								{#if !plugin.metadata.builtin}
									<Button
										size="sm"
										variant="ghost"
										onclick={() => handleUpdatePlugin(plugin.metadata.id)}
										disabled={updatingPlugins.has(plugin.metadata.id)}
									>
										{#if updatingPlugins.has(plugin.metadata.id)}
											<Loader2 class="h-4 w-4 animate-spin" />
										{:else}
											{m.plugins_button_update()}
										{/if}
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onclick={() => openUninstallDialog(plugin)}
										class="text-destructive hover:text-destructive"
									>
										{m.plugins_button_uninstall()}
									</Button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</TabsContent>

		<!-- Builtin Tab -->
		<TabsContent value="builtin" class="mt-6">
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<div class="text-center">
						<RefreshCw class="mx-auto mb-4 h-10 w-10 animate-spin text-muted-foreground" />
						<p class="text-muted-foreground">{m.plugins_loading()}</p>
					</div>
				</div>
			{:else if filteredPlugins.length === 0}
				<div class="flex items-center justify-center py-12">
					<p class="text-muted-foreground">{m.plugins_no_plugins_found()}</p>
				</div>
			{:else}
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each filteredPlugins as plugin (plugin.metadata.id)}
						<div
							class="group relative rounded-lg border p-4 transition-all hover:border-primary hover:shadow-md"
						>
							<!-- Same plugin card content as installed tab -->
							{#if plugin.metadata.builtin}
								<div class="absolute right-2 top-2">
									<Badge variant="secondary" class="text-xs">{m.plugins_badge_builtin()}</Badge>
								</div>
							{/if}
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
							<p class="mb-3 text-sm text-muted-foreground line-clamp-2">
								{plugin.metadata.description}
							</p>
							{#if plugin.metadata.tags && plugin.metadata.tags.length > 0}
								<div class="mb-3 flex flex-wrap gap-1">
									{#each plugin.metadata.tags.slice(0, 3) as tag (tag)}
										<Badge variant="outline" class="text-xs">{tag}</Badge>
									{/each}
								</div>
							{/if}
							<p class="text-xs text-muted-foreground mb-3">
								{m.plugins_author_by()}
								{plugin.metadata.author}
							</p>
							<div class="flex gap-2 flex-wrap">
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
								<Button size="sm" variant="ghost" onclick={() => openDetails(plugin)}>
									{m.plugins_button_details()}
								</Button>
								<Button size="sm" variant="ghost" onclick={() => openSettings(plugin)}>
									{m.plugins_button_settings()}
								</Button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</TabsContent>

		<!-- ThirdParty Tab -->
		<TabsContent value="thirdparty" class="mt-6">
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<div class="text-center">
						<RefreshCw class="mx-auto mb-4 h-10 w-10 animate-spin text-muted-foreground" />
						<p class="text-muted-foreground">{m.plugins_loading()}</p>
					</div>
				</div>
			{:else if filteredPlugins.length === 0}
				<div class="flex items-center justify-center py-12">
					<p class="text-muted-foreground">{m.plugins_no_plugins_found()}</p>
				</div>
			{:else}
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each filteredPlugins as plugin (plugin.metadata.id)}
						<div
							class="group relative rounded-lg border p-4 transition-all hover:border-primary hover:shadow-md"
						>
							<!-- Same plugin card content -->
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
							<p class="mb-3 text-sm text-muted-foreground line-clamp-2">
								{plugin.metadata.description}
							</p>
							{#if plugin.metadata.tags && plugin.metadata.tags.length > 0}
								<div class="mb-3 flex flex-wrap gap-1">
									{#each plugin.metadata.tags.slice(0, 3) as tag (tag)}
										<Badge variant="outline" class="text-xs">{tag}</Badge>
									{/each}
								</div>
							{/if}
							<p class="text-xs text-muted-foreground mb-3">
								{m.plugins_author_by()}
								{plugin.metadata.author}
							</p>
							<div class="flex gap-2 flex-wrap">
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
								<Button size="sm" variant="ghost" onclick={() => openDetails(plugin)}>
									{m.plugins_button_details()}
								</Button>
								<Button size="sm" variant="ghost" onclick={() => openSettings(plugin)}>
									{m.plugins_button_settings()}
								</Button>
								{#if !plugin.metadata.builtin}
									<Button
										size="sm"
										variant="ghost"
										onclick={() => handleUpdatePlugin(plugin.metadata.id)}
										disabled={updatingPlugins.has(plugin.metadata.id)}
									>
										{#if updatingPlugins.has(plugin.metadata.id)}
											<RefreshCw class="h-4 w-4 animate-spin" />
										{:else}
											{m.plugins_button_update()}
										{/if}
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onclick={() => openUninstallDialog(plugin)}
										class="text-destructive hover:text-destructive"
									>
										{m.plugins_button_uninstall()}
									</Button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</TabsContent>

		<!-- Marketplace Tab -->
		<TabsContent value="marketplace" class="mt-6">
			{#if isLoadingMarketplace}
				<div class="flex items-center justify-center py-12">
					<div class="text-center">
						<RefreshCw class="mx-auto mb-4 h-10 w-10 animate-spin text-muted-foreground" />
						<p class="text-muted-foreground">{m.plugins_marketplace_loading()}</p>
					</div>
				</div>
			{:else if marketplacePlugins.length === 0}
				<div class="flex items-center justify-center py-12">
					<div class="text-center">
						<p class="text-muted-foreground mb-4">{m.plugins_marketplace_no_plugins()}</p>
						<Button variant="outline" onclick={handleRefreshMarketplace}>
							<RefreshCw class="mr-2 h-4 w-4" />
							{m.plugins_marketplace_refresh()}
						</Button>
					</div>
				</div>
			{:else}
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each marketplacePlugins.filter((p) => p?.metadata?.id) as plugin (plugin.metadata.id)}
						<div
							class="group relative rounded-lg border p-4 transition-all hover:border-primary hover:shadow-md"
						>
							<!-- Featured badge -->
							{#if plugin.featured}
								<div class="absolute right-2 top-2">
									<Badge variant="default" class="text-xs">
										<Star class="mr-1 h-3 w-3" />
										{m.plugins_marketplace_featured()}
									</Badge>
								</div>
							{/if}

							<!-- Plugin icon and header -->
							<div class="mb-3 flex items-start justify-between">
								<div class="flex items-center gap-3">
									{#if plugin.icon}
										<img src={plugin.icon} alt={plugin.metadata.name} class="h-10 w-10 rounded" />
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
										<p class="text-xs text-muted-foreground">v{plugin.metadata.version}</p>
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
									{#each plugin.metadata.tags.slice(0, 3) as tag (tag)}
										<Badge variant="outline" class="text-xs">{tag}</Badge>
									{/each}
								</div>
							{/if}

							<!-- Stats -->
							<div class="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
								<span>
									<Download class="mr-1 inline h-3 w-3" />
									{plugin.downloads}
								</span>
								{#if plugin.ratingCount > 0}
									<span>
										<Star class="mr-1 inline h-3 w-3" />
										{plugin.rating.toFixed(1)} ({plugin.ratingCount})
									</span>
								{/if}
							</div>

							<!-- Author -->
							<p class="text-xs text-muted-foreground mb-3">
								{m.plugins_marketplace_by()}
								{plugin.metadata.author}
							</p>

							<!-- Actions -->
							<div class="flex gap-2">
								{#if pluginState.isPluginInstalled(plugin.metadata.id)}
									<Button size="sm" variant="outline" class="flex-1" disabled
										>{m.plugins_marketplace_installed()}</Button
									>
								{:else}
									<Button
										size="sm"
										variant="default"
										class="flex-1"
										onclick={() => handleInstallFromMarketplace(plugin.metadata.id)}
										disabled={isInstalling}
									>
										{#if isInstalling}
											<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
										{:else}
											<Download class="mr-2 h-4 w-4" />
										{/if}
										{m.plugins_marketplace_install()}
									</Button>
								{/if}
								<Button size="sm" variant="ghost" onclick={() => openMarketplaceDetails(plugin)}>
									{m.plugins_marketplace_details()}
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
						{#each Object.entries(selectedPlugin.metadata.configSchema.properties) as [key, schema] (key)}
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
										{#each schema.enum as option (option)}
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

<!-- Plugin Install Dialog -->
<Dialog bind:open={installDialogOpen}>
	<DialogContent class="max-w-lg">
		<DialogHeader>
			<DialogTitle>{m.plugins_install_dialog_title()}</DialogTitle>
			<DialogDescription>{m.plugins_install_dialog_description()}</DialogDescription>
		</DialogHeader>

		<div class="space-y-4 py-4">
			<!-- Installation Source Type -->
			<div class="space-y-2">
				<Label>{m.plugins_install_source_type()}</Label>
				<div class="grid grid-cols-2 gap-2">
					<Button
						variant={installSource === "local" ? "default" : "outline"}
						size="sm"
						onclick={() => (installSource = "local")}
						class="justify-start"
					>
						{m.plugins_install_source_local()}
					</Button>
					<Button
						variant={installSource === "url" ? "default" : "outline"}
						size="sm"
						onclick={() => (installSource = "url")}
						class="justify-start"
					>
						{m.plugins_install_source_url()}
					</Button>
				</div>
			</div>

			<!-- Local Path Input -->
			{#if installSource === "local"}
				<div class="space-y-2">
					<Label for="plugin-path">{m.plugins_install_path_label()}</Label>
					<div class="flex gap-2">
						<Input
							id="plugin-path"
							type="text"
							bind:value={installPath}
							placeholder={m.plugins_install_path_placeholder()}
							class="flex-1"
						/>
						<Button variant="outline" size="icon" onclick={selectFolder}>
							<FolderOpen class="h-4 w-4" />
						</Button>
					</div>
				</div>
			{/if}

			<!-- URL Input -->
			{#if installSource === "url"}
				<div class="space-y-2">
					<Label for="plugin-url">{m.plugins_install_url_label()}</Label>
					<Input
						id="plugin-url"
						type="text"
						bind:value={installUrl}
						placeholder={m.plugins_install_url_placeholder()}
					/>
					<p class="text-xs text-muted-foreground">This feature is not yet implemented.</p>
				</div>
			{/if}
		</div>

		<DialogFooter>
			<Button variant="outline" onclick={() => (installDialogOpen = false)}
				>{m.plugins_settings_cancel()}</Button
			>
			<Button onclick={handleInstallPlugin} disabled={isInstalling}>
				{#if isInstalling}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{m.plugins_install_installing()}
				{:else}
					<Plus class="mr-2 h-4 w-4" />
					{m.plugins_install_button_install()}
				{/if}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<!-- Plugin Uninstall Confirmation Dialog -->
<Dialog bind:open={uninstallDialogOpen}>
	<DialogContent class="max-w-md">
		<DialogHeader>
			<DialogTitle>{m.plugins_uninstall_confirm_title()}</DialogTitle>
			<DialogDescription>
				{m.plugins_uninstall_confirm_description({ name: selectedPlugin?.metadata.name || "" })}
			</DialogDescription>
		</DialogHeader>

		{#if selectedPlugin}
			<div class="space-y-3 py-4">
				<div class="rounded-lg bg-muted p-4">
					<div class="flex items-center gap-3 mb-2">
						{#if selectedPlugin.metadata.icon}
							<img
								src={selectedPlugin.metadata.icon}
								alt={selectedPlugin.metadata.name}
								class="h-8 w-8 rounded"
							/>
						{:else}
							<div
								class="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-primary"
							>
								<span class="text-sm font-bold">
									{selectedPlugin.metadata.name.charAt(0).toUpperCase()}
								</span>
							</div>
						{/if}
						<div>
							<p class="font-medium">{selectedPlugin.metadata.name}</p>
							<p class="text-xs text-muted-foreground">v{selectedPlugin.metadata.version}</p>
						</div>
					</div>
					<p class="text-sm text-muted-foreground">{selectedPlugin.metadata.description}</p>
				</div>
			</div>
		{/if}

		<DialogFooter>
			<Button variant="outline" onclick={() => (uninstallDialogOpen = false)}
				>{m.plugins_settings_cancel()}</Button
			>
			<Button variant="destructive" onclick={handleUninstallPlugin} disabled={isUninstalling}>
				{#if isUninstalling}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{/if}
				{m.plugins_uninstall_button_confirm()}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<!-- Plugin Details Dialog -->
<Dialog bind:open={detailsDialogOpen}>
	<DialogContent class="max-w-3xl max-h-[85vh] overflow-y-auto">
		<DialogHeader>
			<DialogTitle>{selectedPlugin?.metadata.name || ""}</DialogTitle>
			<DialogDescription>
				{selectedPlugin?.metadata.description || ""}
			</DialogDescription>
		</DialogHeader>

		{#if selectedPlugin}
			<div class="space-y-6 py-4">
				<!-- Plugin Header -->
				<div class="flex items-start gap-4">
					{#if selectedPlugin.metadata.icon}
						<img
							src={selectedPlugin.metadata.icon}
							alt={selectedPlugin.metadata.name}
							class="h-16 w-16 rounded-lg"
						/>
					{:else}
						<div
							class="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-primary"
						>
							<span class="text-2xl font-bold">
								{selectedPlugin.metadata.name.charAt(0).toUpperCase()}
							</span>
						</div>
					{/if}
					<div class="flex-1">
						<div class="flex items-center gap-2 mb-1">
							<h3 class="text-xl font-semibold">{selectedPlugin.metadata.name}</h3>
							<Badge variant={getStatusBadgeVariant(selectedPlugin.status)}>
								{getStatusText(selectedPlugin.status)}
							</Badge>
							{#if selectedPlugin.metadata.builtin}
								<Badge variant="secondary">{m.plugins_badge_builtin()}</Badge>
							{/if}
						</div>
						<p class="text-sm text-muted-foreground mb-2">v{selectedPlugin.metadata.version}</p>
						<div class="flex flex-wrap gap-2">
							{#if selectedPlugin.metadata.tags && selectedPlugin.metadata.tags.length > 0}
								{#each selectedPlugin.metadata.tags as tag (tag)}
									<Badge variant="outline" class="text-xs">
										{tag}
									</Badge>
								{/each}
							{/if}
						</div>
					</div>
				</div>

				<!-- Plugin Information Grid -->
				<div class="grid gap-4 md:grid-cols-2">
					<!-- Basic Info -->
					<div class="rounded-lg border p-4 space-y-2">
						<h4 class="font-medium text-sm mb-3">{m.plugins_details_basic_info()}</h4>
						<div class="space-y-1.5 text-sm">
							<div class="flex justify-between">
								<span class="text-muted-foreground">{m.plugins_details_author()}：</span>
								<span class="font-medium">{selectedPlugin.metadata.author}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-muted-foreground">{m.plugins_details_version()}：</span>
								<span class="font-medium">{selectedPlugin.metadata.version}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-muted-foreground">{m.plugins_details_id()}：</span>
								<span class="font-mono text-xs">{selectedPlugin.metadata.id}</span>
							</div>
						</div>
					</div>

					<!-- Installation Info -->
					<div class="rounded-lg border p-4 space-y-2">
						<h4 class="font-medium text-sm mb-3">{m.plugins_details_installation_info()}</h4>
						<div class="space-y-1.5 text-sm">
							<div class="flex justify-between">
								<span class="text-muted-foreground">{m.plugins_details_type()}：</span>
								<span class="font-medium">
									{selectedPlugin.metadata.builtin
										? m.plugins_details_builtin()
										: m.plugins_details_third_party()}
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-muted-foreground">{m.plugins_details_status()}：</span>
								<span class="font-medium">{getStatusText(selectedPlugin.status)}</span>
							</div>
							{#if selectedPlugin.installedAt}
								<div class="flex justify-between">
									<span class="text-muted-foreground">{m.plugins_details_installed_at()}：</span>
									<span class="font-medium">
										{new Date(selectedPlugin.installedAt).toLocaleDateString()}
									</span>
								</div>
							{/if}
							<div class="flex flex-col gap-1">
								<span class="text-muted-foreground">{m.plugins_details_path()}：</span>
								<span class="font-mono text-xs break-all">{selectedPlugin.path}</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Description -->
				<div class="rounded-lg border p-4">
					<h4 class="font-medium text-sm mb-2">{m.plugins_details_full_description()}</h4>
					<p class="text-sm text-muted-foreground">
						{selectedPlugin.metadata.description}
					</p>
				</div>

				<!-- Configuration Schema -->
				{#if selectedPlugin.metadata.configSchema?.properties && Object.keys(selectedPlugin.metadata.configSchema.properties).length > 0}
					<div class="rounded-lg border p-4">
						<h4 class="font-medium text-sm mb-3">{m.plugins_details_configurable_options()}</h4>
						<div class="space-y-2">
							{#each Object.entries(selectedPlugin.metadata.configSchema.properties) as [key, schema] (key)}
								<div class="flex items-start gap-3 text-sm">
									<div class="flex-1">
										<div class="font-medium">
											{schema.title || key}
											{#if Array.isArray(selectedPlugin.metadata.configSchema.required) && selectedPlugin.metadata.configSchema.required.includes(key)}
												<span class="text-destructive text-xs ml-1">*</span>
											{/if}
										</div>
										{#if schema.description}
											<div class="text-muted-foreground text-xs mt-0.5">
												{schema.description}
											</div>
										{/if}
									</div>
									<Badge variant="outline" class="text-xs">{schema.type}</Badge>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Permissions -->
				{#if selectedPlugin.metadata.permissions && selectedPlugin.metadata.permissions.length > 0}
					<div class="rounded-lg border p-4">
						<h4 class="font-medium text-sm mb-3">{m.plugins_details_permissions()}</h4>
						<div class="flex flex-wrap gap-2">
							{#each selectedPlugin.metadata.permissions as permission (permission)}
								<Badge variant="secondary" class="text-xs">
									{permission}
								</Badge>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<DialogFooter>
				<Button variant="outline" onclick={() => (detailsDialogOpen = false)}
					>{m.plugins_details_close()}</Button
				>
				<Button
					variant="default"
					onclick={() => {
						detailsDialogOpen = false;
						if (selectedPlugin) openSettings(selectedPlugin);
					}}
				>
					{m.plugins_button_settings()}
				</Button>
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>

<!-- Marketplace Plugin Details Dialog -->
<Dialog bind:open={marketplaceDetailsDialogOpen}>
	<DialogContent class="max-w-3xl max-h-[85vh] overflow-y-auto">
		<DialogHeader>
			<DialogTitle>{selectedMarketplacePlugin?.metadata.name || ""}</DialogTitle>
			<DialogDescription>
				{selectedMarketplacePlugin?.metadata.description || ""}
			</DialogDescription>
		</DialogHeader>

		{#if selectedMarketplacePlugin}
			<div class="space-y-6 py-4">
				<!-- Plugin Header -->
				<div class="flex items-start gap-4">
					{#if selectedMarketplacePlugin.icon}
						<img
							src={selectedMarketplacePlugin.icon}
							alt={selectedMarketplacePlugin.metadata.name}
							class="h-16 w-16 rounded-lg"
						/>
					{:else}
						<div
							class="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-primary"
						>
							<span class="text-2xl font-bold">
								{selectedMarketplacePlugin.metadata.name.charAt(0).toUpperCase()}
							</span>
						</div>
					{/if}
					<div class="flex-1">
						<div class="flex items-center gap-2 mb-1">
							<h3 class="text-xl font-semibold">{selectedMarketplacePlugin.metadata.name}</h3>
							{#if selectedMarketplacePlugin.featured}
								<Badge variant="default">
									<Star class="mr-1 h-3 w-3" />
									{m.plugins_marketplace_featured()}
								</Badge>
							{/if}
						</div>
						<p class="text-sm text-muted-foreground">
							v{selectedMarketplacePlugin.metadata.version}
						</p>
						<p class="text-sm text-muted-foreground">
							{m.plugins_marketplace_by()}
							{selectedMarketplacePlugin.metadata.author}
						</p>
						{#if selectedMarketplacePlugin.metadata.tags && selectedMarketplacePlugin.metadata.tags.length > 0}
							<div class="flex flex-wrap gap-2 mt-2">
								{#each selectedMarketplacePlugin.metadata.tags as tag (tag)}
									<Badge variant="outline" class="text-xs">{tag}</Badge>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- Stats -->
				<div class="grid gap-4 md:grid-cols-3">
					<div class="rounded-lg border p-3">
						<p class="text-sm font-medium">{m.plugins_marketplace_downloads()}</p>
						<p class="text-2xl font-bold">{selectedMarketplacePlugin.downloads}</p>
					</div>
					{#if selectedMarketplacePlugin.ratingCount > 0}
						<div class="rounded-lg border p-3">
							<p class="text-sm font-medium">{m.plugins_marketplace_rating()}</p>
							<p class="text-2xl font-bold">
								{selectedMarketplacePlugin.rating.toFixed(1)}/5
							</p>
							<p class="text-xs text-muted-foreground">
								({selectedMarketplacePlugin.ratingCount}
								{m.plugins_marketplace_ratings()})
							</p>
						</div>
					{/if}
					<div class="rounded-lg border p-3">
						<p class="text-sm font-medium">{m.plugins_marketplace_last_updated()}</p>
						<p class="text-sm">
							{new Date(selectedMarketplacePlugin.updatedAt).toLocaleDateString()}
						</p>
					</div>
				</div>

				<!-- Description -->
				<div class="rounded-lg border p-4">
					<h4 class="font-medium text-sm mb-2">{m.plugins_marketplace_description()}</h4>
					<p class="text-sm text-muted-foreground">
						{selectedMarketplacePlugin.metadata.description}
					</p>
				</div>

				<!-- Links -->
				<div class="flex gap-2">
					{#if selectedMarketplacePlugin.repository}
						<Button
							variant="outline"
							size="sm"
							onclick={() =>
								window.electronAPI.externalLinkService.openExternalLink(
									selectedMarketplacePlugin?.repository || "",
								)}
						>
							{m.plugins_marketplace_repository()}
						</Button>
					{/if}
					{#if selectedMarketplacePlugin.homepage}
						<Button
							variant="outline"
							size="sm"
							onclick={() =>
								window.electronAPI.externalLinkService.openExternalLink(
									selectedMarketplacePlugin?.homepage || "",
								)}
						>
							{m.plugins_marketplace_homepage()}
						</Button>
					{/if}
				</div>
			</div>

			<DialogFooter>
				<Button variant="outline" onclick={() => (marketplaceDetailsDialogOpen = false)}>
					{m.plugins_marketplace_close()}
				</Button>
				{#if !pluginState.isPluginInstalled(selectedMarketplacePlugin.metadata.id)}
					<Button
						variant="default"
						onclick={() =>
							handleInstallFromMarketplace(selectedMarketplacePlugin?.metadata.id || "")}
						disabled={isInstalling}
					>
						{#if isInstalling}
							<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
						{/if}
						<Download class="mr-2 h-4 w-4" />
						{m.plugins_marketplace_install()}
					</Button>
				{:else}
					<Button variant="outline" disabled>{m.plugins_marketplace_already_installed()}</Button>
				{/if}
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>
