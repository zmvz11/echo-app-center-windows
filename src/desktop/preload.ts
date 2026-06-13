import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('echoDesktop', {
  openAppBuilder: (appId?: string) => ipcRenderer.invoke('echo:open-app-builder', appId),
  openStoreLayoutBuilder: () => ipcRenderer.invoke('echo:open-store-layout-builder'),
  closeStoreLayoutBuilder: () => ipcRenderer.invoke('echo:close-store-layout-builder'),
  focusMainWindow: () => ipcRenderer.invoke('echo:focus-main-window'),
  closeBuilderWindow: () => ipcRenderer.invoke('echo:close-builder-window'),
  onBuilderSelectApp: (callback: (appId: string) => void) => {
    const listener = (_event: unknown, appId: string) => callback(appId);
    ipcRenderer.on('echo:builder-select-app', listener);
    return () => ipcRenderer.removeListener('echo:builder-select-app', listener);
  },
});
