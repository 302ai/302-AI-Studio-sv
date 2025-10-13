import { AiApplicationService, aiApplicationService } from "./ai-application-service";
import { AppService, appService } from "./app-service";
import { AttachmentsService, attachmentsService } from "./attachments-sevice";
import { BroadcastService, broadcastService } from "./broadcast-service";
import { ExternalLinkService, externalLinkService } from "./external-link-service";
import { GeneralSettingsService, generalSettingsService } from "./general-setting-service";
import { ShortcutService, shortcutService } from "./shortcut-service";
import { StorageService, storageService } from "./storage-service";
import { TabService, tabService } from "./tab-service";
import { ThreadService, threadService } from "./thread-service";
import { WindowService, windowService } from "./window-service";

// Export service classes for type definitions
export {
	AiApplicationService,
	AppService,
	AttachmentsService,
	BroadcastService,
	ExternalLinkService,
	GeneralSettingsService,
	ShortcutService,
	StorageService,
	TabService,
	ThreadService,
	WindowService,
};

// Export service instances for use in IPC registration
export {
	aiApplicationService,
	appService,
	attachmentsService,
	broadcastService,
	externalLinkService,
	generalSettingsService,
	shortcutService,
	storageService,
	tabService,
	threadService,
	windowService,
};
