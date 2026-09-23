export const ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'tenant.read',
  'tenant.update',
  'tenant.members.read',
  'tenant.members.manage',
  'marketplace.seller.read',
  'marketplace.seller.manage',
  'marketplace.listing.read',
  'marketplace.listing.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: [
    'tenant.read',
    'tenant.update',
    'tenant.members.read',
    'tenant.members.manage',
    'marketplace.seller.read',
    'marketplace.seller.manage',
    'marketplace.listing.read',
    'marketplace.listing.manage',
  ],
  ADMIN: [
    'tenant.read',
    'tenant.members.read',
    'tenant.members.manage',
    'marketplace.seller.read',
    'marketplace.seller.manage',
    'marketplace.listing.read',
    'marketplace.listing.manage',
  ],
  MEMBER: [
    'tenant.read',
    'marketplace.seller.read',
    'marketplace.listing.read',
  ],
};

export const hasPermission = (role: Role, permission: Permission): boolean => {
  const allowed = ROLE_PERMISSIONS[role];
  return allowed ? allowed.includes(permission) : false;
};
