import { AppService, appService } from "./app-service";
import { AttachmentsService, attachmentsService } from "./attachments-sevice";
import { StorageService, storageService } from "./storage-service";
import { TabService, tabService } from "./tab-service";
import { WindowService, windowService } from "./window-service";

// Export service classes for type definitions
export { AppService, AttachmentsService, StorageService, TabService, WindowService };

// Export service instances for use in IPC registration
export { appService, attachmentsService, storageService, tabService, windowService };
