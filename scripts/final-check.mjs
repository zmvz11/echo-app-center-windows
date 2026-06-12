import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const steps = [
  ['lint', 'npm run lint'],
  ['typecheck', 'npm run typecheck'],
  ['build', 'npm run build']
];

for (const [name, command] of steps) {
  console.log(`Running ${name}...`);
  execSync(command, { stdio: 'inherit', shell: true });
}

const packageLock = existsSync('package-lock.json') ? readFileSync('package-lock.json', 'utf8') : '';
const forbiddenRegistryMarkers = ['applied-' + 'caas', 'internal.api.' + 'openai.org'];
if (forbiddenRegistryMarkers.some((marker) => packageLock.includes(marker))) {
  throw new Error('package-lock.json contains internal registry URLs.');
}

const appPackage = JSON.parse(readFileSync('package.json', 'utf8'));
if (!appPackage.build || appPackage.build.productName !== 'Echo App Center') {
  throw new Error('Missing Electron builder config for Echo App Center.');
}
if (!existsSync('src/desktop/main.ts')) throw new Error('Missing Electron desktop main file.');
if (!existsSync('src/desktop/preload.ts')) throw new Error('Missing Electron preload bridge.');
if (!existsSync('dist-electron/main.js')) {
  throw new Error('Electron build output missing: dist-electron/main.js. Check tsconfig.electron.json rootDir/outDir.');
}
if (!existsSync('src/local-agent/index.ts')) throw new Error('Missing local agent.');

const appSourceChecks = [
  ['src/App.tsx', 'setTimeout', 'startup timeout guard'],
  ['src/api/echoServerClient.ts', 'fetchWithTimeout', 'server request timeout guard'],
  ['src/pages/LoginPage.tsx', 'Save login on this device', 'save login checkbox'],
  ['src/pages/AdminPortalPage.tsx', 'Could not ${nextVisibility', 'post app error handling'],
  ['src/components/StoreComponents.tsx', 'scrollByCards', 'Store row arrow scrolling'],
  ['src/pages/StorePage.tsx', 'Store API was unavailable', 'Store API fallback message']
];
for (const [file, marker, label] of appSourceChecks) {
  const text = readFileSync(file, 'utf8');
  if (!text.includes(marker)) throw new Error(`Missing ${label} in ${file}`);
}
const adminPortalText = readFileSync('src/pages/AdminPortalPage.tsx', 'utf8');
if (adminPortalText.includes('Apps & Media')) throw new Error('Old Apps & Media label still exists.');

const v5Checks = [
  ['src/desktop/main.ts', 'echo:open-app-builder', 'separate Add App Builder desktop window IPC'],
  ['src/pages/AdminPortalPage.tsx', 'Open Echo App Builder', 'Add Apps launcher'],
  ['src/pages/AdminPortalPage.tsx', 'GitHub Repository Source', 'GitHub source builder UI'],
  ['src/api/echoServerClient.ts', 'importLatestGitHubRelease', 'GitHub source API client'],
  ['src/pages/AdminPortalPage.tsx', 'Unsaved changes are in this builder window', 'unsaved changes warning'],
  ['src/pages/SettingsPage.tsx', 'Reset Saved Login', 'settings saved-login reset'],
  ['src/pages/SettingsPage.tsx', 'Storage Libraries', 'premium storage settings']
];
for (const [file, marker, label] of v5Checks) {
  const text = readFileSync(file, 'utf8');
  if (!text.includes(marker)) throw new Error(`Missing ${label} in ${file}`);
}

if (!existsSync('README.md')) throw new Error('Missing README.md');
if (!existsSync('docs/INSTALL.md')) throw new Error('Missing docs/INSTALL.md');
if (!existsSync('docs/GITHUB_APP_SOURCE.md')) throw new Error('Missing docs/GITHUB_APP_SOURCE.md');
if (!existsSync('docs/SERVER_NODES.md')) throw new Error('Missing docs/SERVER_NODES.md');

const v8Checks = [
  ['src/pages/SettingsPage.tsx', 'Server Nodes', 'settings server nodes page'],
  ['src/pages/SettingsPage.tsx', 'Download Server Location', 'download server location selector'],
  ['src/auth/sessionStore.ts', 'setDownloadLocationPreference', 'download location preference storage'],
  ['src/api/echoServerClient.ts', 'approveNodeRequest', 'node approval API client'],
  ['src/local-agent/index.ts', 'packageDownloadUrl', 'local agent download mirror URL rewrite']
];
for (const [file, marker, label] of v8Checks) {
  const text = readFileSync(file, 'utf8');
  if (!text.includes(marker)) throw new Error(`Missing ${label} in ${file}`);
}
console.log('Echo App Center final check passed.');
