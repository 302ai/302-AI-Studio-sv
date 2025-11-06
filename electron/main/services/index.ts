import { AiApplicationService, aiApplicationService } from "./ai-application-service";
import { AppService, appService } from "./app-service";
import { AttachmentsService, attachmentsService } from "./attachments-sevice";
import { BroadcastService, broadcastService } from "./broadcast-service";
import { CodeAgentService, codeAgentService } from "./code-agent-service";
import { DataService, dataService } from "./data-service";
import { ExternalLinkService, externalLinkService } from "./external-link-service";
import { GhostWindowService, ghostWindowService } from "./ghost-window-service";
import { McpService, mcpService } from "./mcp-service";
import { PluginService, pluginService } from "./plugin-service";
import { RegistryService, registryService } from "./registry-service";
import { GeneralSettingsService, generalSettingsService } from "./settings-service";
import { ShortcutService, shortcutService } from "./shortcut-service";
import { StorageService, storageService } from "./storage-service";
import { TabService, tabService } from "./tab-service";
import { ThreadService, threadService } from "./thread-service";
import { TrayService, trayService } from "./tray-service";
import { UpdaterService, updaterService } from "./updater-service";
import { WindowService, windowService } from "./window-service";

// Export service classes for type definitions
export {
	AiApplicationService,
	AppService,
	AttachmentsService,
	BroadcastService,
	CodeAgentService,
	DataService,
	ExternalLinkService,
	GeneralSettingsService,
	GhostWindowService,
	McpService,
	PluginService,
	RegistryService,
	ShortcutService,
	StorageService,
	TabService,
	ThreadService,
	TrayService,
	UpdaterService,
	WindowService,
};

// Export service instances for use in IPC registration
export {
	aiApplicationService,
	appService,
	attachmentsService,
	broadcastService,
	codeAgentService,
	dataService,
	externalLinkService,
	generalSettingsService,
	ghostWindowService,
	mcpService,
	pluginService,
	registryService,
	shortcutService,
	storageService,
	tabService,
	threadService,
	trayService,
	updaterService,
	windowService,
};
