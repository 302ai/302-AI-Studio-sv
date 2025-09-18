import { AttachmentsService, attachmentsService } from "./attachments-sevice";
import { WindowService, windowService } from "./window-service";
import { AppService, appService } from "./app-service";
import { DeviceService, deviceService } from "./device-service";
import { StorageService, storageService } from "./storage-service";

// Export service classes for type definitions
export { AttachmentsService, WindowService, AppService, StorageService, DeviceService };

// Export service instances for use in IPC registration
export { attachmentsService, windowService, appService, storageService, deviceService };
