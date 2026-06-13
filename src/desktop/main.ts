import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;
let builderWindow: BrowserWindow | null = null;
let storeLayoutWindow: BrowserWindow | null = null;
let agentServer: { close: (callback?: () => void) => void } | null = null;

function webPreferences() {
  return {
    preload: join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
  };
}

async function startLocalAgent(): Promise<void> {
  process.env.ECHO_AGENT_AUTOSTART = 'false';
  process.env.ECHO_AGENT_HOST = process.env.ECHO_AGENT_HOST || '127.0.0.1';
  process.env.ECHO_AGENT_PORT = process.env.ECHO_AGENT_PORT || '17888';
  const agentModuleUrl = new URL('../dist-agent/local-agent/index.js', import.meta.url);
  const agentModule = await import(agentModuleUrl.href) as { startLocalAgent: () => { close: (callback?: () => void) => void } };
  agentServer = agentModule.startLocalAgent();
}

function attachExternalLinkHandler(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    if (url.startsWith('file:') || url.includes('#app-builder') || url.includes('#store-layout-builder')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 700,
    title: 'Echo App Center',
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: webPreferences(),
  });

  attachExternalLinkHandler(mainWindow);
  const indexPath = join(__dirname, '../dist/index.html');
  void mainWindow.loadFile(indexPath);
  mainWindow.on('closed', () => { mainWindow = null; });
}

function createBuilderWindow(appId?: string): void {
  if (builderWindow && !builderWindow.isDestroyed()) {
    builderWindow.focus();
    if (appId) builderWindow.webContents.send('echo:builder-select-app', appId);
    return;
  }

  builderWindow = new BrowserWindow({
    width: 1620,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    title: 'Echo App Builder',
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    parent: mainWindow ?? undefined,
    modal: false,
    webPreferences: webPreferences(),
  });

  attachExternalLinkHandler(builderWindow);
  const indexPath = join(__dirname, '../dist/index.html');
  const hash = appId ? `app-builder?appId=${encodeURIComponent(appId)}` : 'app-builder';
  void builderWindow.loadFile(indexPath, { hash });
  builderWindow.on('closed', () => { builderWindow = null; });
}


function createStoreLayoutWindow(): void {
  if (storeLayoutWindow && !storeLayoutWindow.isDestroyed()) {
    storeLayoutWindow.focus();
    return;
  }

  storeLayoutWindow = new BrowserWindow({
    width: 1720,
    height: 980,
    minWidth: 1240,
    minHeight: 780,
    title: 'Echo Store Layout Creator',
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    parent: mainWindow ?? undefined,
    modal: false,
    webPreferences: webPreferences(),
  });

  attachExternalLinkHandler(storeLayoutWindow);
  const indexPath = join(__dirname, '../dist/index.html');
  void storeLayoutWindow.loadFile(indexPath, { hash: 'store-layout-builder' });
  storeLayoutWindow.on('closed', () => { storeLayoutWindow = null; });
}

function registerIpc(): void {
  ipcMain.handle('echo:open-app-builder', (_event: unknown, appId?: string) => {
    createBuilderWindow(appId);
    return { ok: true };
  });
  ipcMain.handle('echo:open-store-layout-builder', () => {
    createStoreLayoutWindow();
    return { ok: true };
  });
  ipcMain.handle('echo:close-store-layout-builder', () => {
    if (storeLayoutWindow && !storeLayoutWindow.isDestroyed()) storeLayoutWindow.close();
    return { ok: true };
  });
  ipcMain.handle('echo:focus-main-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
    return { ok: true };
  });
  ipcMain.handle('echo:close-builder-window', () => {
    if (builderWindow && !builderWindow.isDestroyed()) builderWindow.close();
    return { ok: true };
  });
}

app.setName('Echo App Center');

app.whenReady().then(() => {
  registerIpc();
  createMainWindow();
  void startLocalAgent().catch((error: unknown) => {
    console.error('Echo App Center local agent failed to start:', error);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
}).catch((error: unknown) => {
  console.error('Failed to start Echo App Center:', error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (agentServer) {
    try { agentServer.close(); } catch { /* ignore */ }
    agentServer = null;
  }
});
