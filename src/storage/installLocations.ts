export type InstallLocation = { id: string; path: string; isDefault: boolean };
const KEY = 'echo_app_center_install_locations';
const DEFAULT = [{ id: "default", path: "C:\\EchoApps", isDefault: true }];

export function getInstallLocations(): InstallLocation[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return DEFAULT;
  try { return JSON.parse(raw) as InstallLocation[]; }
  catch { return DEFAULT; }
}

export function saveInstallLocations(locations: InstallLocation[]): void {
  localStorage.setItem(KEY, JSON.stringify(locations));
}
