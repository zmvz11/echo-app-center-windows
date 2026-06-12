declare module 'electron' {
  export const app: any;
  export const BrowserWindow: any;
  export const shell: any;
  export const ipcMain: any;
  export const contextBridge: any;
  export const ipcRenderer: any;
}

declare global {
  interface Window {
    echoDesktop?: {
      openAppBuilder: (appId?: string) => Promise<{ ok: boolean }>;
      focusMainWindow: () => Promise<{ ok: boolean }>;
      closeBuilderWindow: () => Promise<{ ok: boolean }>;
      onBuilderSelectApp: (callback: (appId: string) => void) => () => void;
    };
  }
}
export {};
