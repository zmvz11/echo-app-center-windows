export type AppMedia = {
  id: string;
  type: 'icon' | 'library_banner' | 'store_banner' | 'screenshot' | 'thumbnail';
  url: string;
  sortOrder: number;
};

export type AppRelease = {
  id: string;
  appId: string;
  version: string;
  channel: 'stable' | 'beta' | 'dev';
  status: string;
  platform: string;
  packageUrl: string;
  packageFileName?: string;
  sizeBytes?: number;
  entrypoint: string;
  installType: 'portable' | 'installer';
  changelog: string[];
  releaseNotes?: string;
};

export type EchoApp = {
  id: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  developer: string;
  category: string;
  tags: string[];
  visibility: string;
  media: AppMedia[];
  releases?: AppRelease[];
};

export type InstalledApp = {
  appId: string;
  name: string;
  version: string;
  platform: string;
  installPath: string;
  entrypoint: string;
  installedAt: string;
  updatedAt: string;
  status: 'installed' | 'broken';
};

export function mediaUrl(app: EchoApp, type: AppMedia['type']): string | undefined {
  return app.media.filter((m) => m.type === type).sort((a,b) => a.sortOrder - b.sortOrder)[0]?.url;
}

export function screenshots(app: EchoApp): AppMedia[] {
  return app.media.filter((m) => m.type === 'screenshot').sort((a,b) => a.sortOrder - b.sortOrder);
}
