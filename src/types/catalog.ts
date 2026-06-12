
export type NodeRole = 'primary' | 'download_mirror' | 'standby_backup' | 'full_backup';
export type NodePermissionKey = 'canPullPackages' | 'canPullMedia' | 'canServeDownloads' | 'canPullDatabaseBackup' | 'canBePromoted' | 'canRunAdminApi';
export type NodePermissions = Record<NodePermissionKey, boolean>;
export type EchoNodeRequest = { id: string; nickname: string; nodeType: NodeRole; baseUrl: string; fingerprint: string; requestedPermissions: NodePermissionKey[]; status: 'pending' | 'approved' | 'rejected'; createdAt: string; reviewedAt?: string; rejectionReason?: string; nodeId?: string; };
export type EchoNode = { id: string; nickname: string; nodeType: NodeRole; baseUrl: string; fingerprint: string; status: 'approved' | 'disabled' | 'offline'; permissions: NodePermissions; createdAt: string; approvedAt: string; lastSeenAt?: string; lastSyncAt?: string; packagesSynced?: number; mediaSynced?: number; storageFreeBytes?: number; healthMessage?: string; };
export type DownloadLocation = { id: string; nickname: string; nodeType: NodeRole; baseUrl: string; status: 'online' | 'offline' | 'unknown'; pingMs?: number; lastSyncAt?: string; storageFreeBytes?: number; isPrimary?: boolean; };
export type NodeAdminState = { nodes: EchoNode[]; requests: EchoNodeRequest[]; syncSettings?: { enabled: boolean; requireApproval: boolean; intervalMinutes: number; allowDownloadMirrors: boolean; allowStandbyBackups: boolean; lastConfiguredAt?: string; } };

export type AppMediaType =
  | 'icon'
  | 'library_banner'
  | 'store_banner'
  | 'store_hero'
  | 'card_thumbnail'
  | 'thumbnail'
  | 'screenshot';

export type AppMedia = {
  id: string;
  type: AppMediaType;
  url: string;
  sortOrder: number;
};

export type PackageValidationReport = { ok: boolean; packageKind: 'zip' | 'echoapp'; fileName: string; checkedAt: string; warnings: string[]; errors: string[]; recommendedManifest?: string; };

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
  sourceType?: 'upload' | 'github_release';
  sourceRepo?: string;
  sourceTag?: string;
  sourceAssetName?: string;
  changelog: string[];
  releaseNotes?: string;
  packageKind?: 'zip' | 'echoapp';
  validation?: PackageValidationReport;
};

export type GitHubAppSource = {
  type: 'github_release';
  owner: string;
  repo: string;
  channel: 'stable' | 'beta' | 'dev';
  platform: string;
  assetPattern: string;
  entrypoint: string;
  installType: 'portable' | 'installer';
  includePrereleases?: boolean;
  tag?: string;
  latestTag?: string;
  latestName?: string;
  latestAssetName?: string;
  latestAssetUrl?: string;
  latestAssetSize?: number;
  latestCheckedAt?: string;
  updateAvailable?: boolean;
  lastImportedTag?: string;
  lastImportedReleaseId?: string;
  lastError?: string;
};

export type EchoApp = {
  id: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  developer: string;
  category: string;
  tags: string[];
  platforms?: string[];
  visibility: string;
  featured?: boolean;
  media: AppMedia[];
  releases?: AppRelease[];
  githubSource?: GitHubAppSource;
};

export type StoreSection = {
  id: string;
  title: string;
  apps: EchoApp[];
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

export function mediaUrl(app: EchoApp, type: AppMediaType): string | undefined {
  return app.media.filter((m) => m.type === type).sort((a,b) => a.sortOrder - b.sortOrder)[0]?.url;
}

export function mediaUrlAny(app: EchoApp, types: AppMediaType[]): string | undefined {
  for (const type of types) {
    const url = mediaUrl(app, type);
    if (url) return url;
  }
  return undefined;
}

export function iconUrl(app: EchoApp): string | undefined {
  return mediaUrl(app, 'icon');
}

export function storeHeroUrl(app: EchoApp): string | undefined {
  return mediaUrlAny(app, ['store_hero', 'store_banner', 'library_banner', 'thumbnail']);
}

export function libraryBannerUrl(app: EchoApp): string | undefined {
  return mediaUrlAny(app, ['library_banner', 'store_hero', 'store_banner', 'thumbnail']);
}

export function cardThumbnailUrl(app: EchoApp): string | undefined {
  return mediaUrlAny(app, ['card_thumbnail', 'thumbnail', 'store_banner', 'store_hero', 'library_banner']);
}

export function screenshots(app: EchoApp): AppMedia[] {
  return app.media.filter((m) => m.type === 'screenshot').sort((a,b) => a.sortOrder - b.sortOrder);
}

export function latestStableRelease(app: EchoApp, platform?: string): AppRelease | undefined {
  const releases = (app.releases ?? []).filter((rel) => rel.status === 'published' && rel.channel === 'stable' && (!platform || rel.platform === platform));
  return releases.sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true })).at(-1);
}
