export const ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'tenant.read',
  'tenant.update',
  'tenant.members.read',
  'tenant.members.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: [
    'tenant.read',
    'tenant.update',
    'tenant.members.read',
    'tenant.members.manage',
  ],
  ADMIN: [
    'tenant.read',
    'tenant.members.read',
    'tenant.members.manage',
  ],
  MEMBER: [
    'tenant.read',
  ],
};

export const hasPermission = (role: Role, permission: Permission): boolean => {
  const allowed = ROLE_PERMISSIONS[role];
  return allowed ? allowed.includes(permission) : false;
};
