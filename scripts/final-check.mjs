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
if (!existsSync('dist-electron/main.js')) {
  throw new Error('Electron build output missing: dist-electron/main.js. Check tsconfig.electron.json rootDir/outDir.');
}
if (!existsSync('src/local-agent/index.ts')) throw new Error('Missing local agent.');
if (!existsSync('README.md')) throw new Error('Missing README.md');
if (!existsSync('docs/INSTALL.md')) throw new Error('Missing docs/INSTALL.md');

console.log('Echo App Center final check passed.');
