import { ipcMain } from 'electron';
import { AttachmentsService } from '../services';

// 自动生成的IPC主进程注册
export function registerIpcHandlers() {
  // attachments 服务注册
  const attachmentsInstance = new AttachmentsService();
  ipcMain.handle('app:attachments:openExternal', (event, url) =>
    attachmentsInstance.openExternal(event, url)
  );
  ipcMain.handle('app:attachments:openExternal2', (event, url) =>
    attachmentsInstance.openExternal2(event, url)
  );
  ipcMain.handle('app:attachments:openExternal3', (event, url) =>
    attachmentsInstance.openExternal3(event, url)
  );
  ipcMain.handle('app:attachments:openExternal4', (event, url) =>
    attachmentsInstance.openExternal4(event, url)
  );
}

// 清理IPC处理器
export function removeIpcHandlers() {
  ipcMain.removeHandler('app:attachments:openExternal');
  ipcMain.removeHandler('app:attachments:openExternal2');
  ipcMain.removeHandler('app:attachments:openExternal3');
  ipcMain.removeHandler('app:attachments:openExternal4');
}
