import { app, BrowserWindow, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let mainWindow: any | null = null;
let agentServer: { close: (callback?: () => void) => void } | null = null;

async function startLocalAgent(): Promise<void> {
  process.env.ECHO_AGENT_AUTOSTART = 'false';
  process.env.ECHO_AGENT_HOST = process.env.ECHO_AGENT_HOST || '127.0.0.1';
  process.env.ECHO_AGENT_PORT = process.env.ECHO_AGENT_PORT || '17888';
  const agentModuleUrl = new URL('../dist-agent/local-agent/index.js', import.meta.url);
  const agentModule = await import(agentModuleUrl.href) as { startLocalAgent: () => { close: (callback?: () => void) => void } };
  agentServer = agentModule.startLocalAgent();
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
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const indexPath = join(__dirname, '../dist/index.html');
  void mainWindow.loadFile(indexPath);
}

app.setName('Echo App Center');

app.whenReady().then(() => {
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
