export function getDefaultPlatform(): string {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('windows')) return 'windows-x64';
  if (userAgent.includes('linux')) return 'linux-x64';
  return 'windows-x64';
}
