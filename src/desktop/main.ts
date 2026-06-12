import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;
let builderWindow: BrowserWindow | null = null;
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
    if (url.startsWith('file:') || url.includes('#app-builder')) return { action: 'allow' };
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

function createBuilderWindow(): void {
  if (builderWindow && !builderWindow.isDestroyed()) {
    builderWindow.focus();
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
  void builderWindow.loadFile(indexPath, { hash: 'app-builder' });
  builderWindow.on('closed', () => { builderWindow = null; });
}

function registerIpc(): void {
  ipcMain.handle('echo:open-app-builder', () => {
    createBuilderWindow();
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
