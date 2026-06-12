export type Permission =
  | 'users.approve'
  | 'users.disable'
  | 'users.edit_role'
  | 'apps.create'
  | 'apps.edit'
  | 'apps.delete'
  | 'media.upload'
  | 'releases.create'
  | 'releases.approve'
  | 'releases.publish'
  | 'releases.rollback'
  | 'logs.view'
  | 'server.settings.edit';

export type CurrentUser = {
  id: string;
  username: string;
  displayName?: string;
  status: string;
  role: string;
  permissions: Permission[];
};

export function userCan(user: CurrentUser | null, permission: Permission): boolean {
  return Boolean(user?.permissions.includes(permission));
}
