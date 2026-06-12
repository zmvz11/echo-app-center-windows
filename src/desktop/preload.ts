import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('echoDesktop', {
  openAppBuilder: () => ipcRenderer.invoke('echo:open-app-builder'),
  focusMainWindow: () => ipcRenderer.invoke('echo:focus-main-window'),
  closeBuilderWindow: () => ipcRenderer.invoke('echo:close-builder-window'),
});
