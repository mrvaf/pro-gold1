export const ROLES = ['OWNER', 'ADMIN', 'OPERATOR', 'MEMBER'] as const;
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
  'seller.os.read',
  'seller.os.manage',
  'seller.staff.read',
  'seller.staff.manage',
  'seller.inventory.read',
  'seller.inventory.manage',
  'seller.listings.read',
  'seller.listings.manage',
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
    'seller.os.read',
    'seller.os.manage',
    'seller.staff.read',
    'seller.staff.manage',
    'seller.inventory.read',
    'seller.inventory.manage',
    'seller.listings.read',
    'seller.listings.manage',
  ],
  ADMIN: [
    'tenant.read',
    'tenant.members.read',
    'tenant.members.manage',
    'marketplace.seller.read',
    'marketplace.seller.manage',
    'marketplace.listing.read',
    'marketplace.listing.manage',
    'seller.os.read',
    'seller.os.manage',
    'seller.staff.read',
    'seller.staff.manage',
    'seller.inventory.read',
    'seller.inventory.manage',
    'seller.listings.read',
    'seller.listings.manage',
  ],
  OPERATOR: [
    'tenant.read',
    'marketplace.seller.read',
    'marketplace.listing.read',
    'seller.os.read',
    'seller.staff.read',
    'seller.inventory.read',
    'seller.inventory.manage',
    'seller.listings.read',
    'seller.listings.manage',
  ],
  MEMBER: [
    'tenant.read',
    'marketplace.seller.read',
    'marketplace.listing.read',
    'seller.os.read',
    'seller.inventory.read',
    'seller.listings.read',
  ],
};

export const hasPermission = (role: Role, permission: Permission): boolean => {
  const allowed = ROLE_PERMISSIONS[role];
  return allowed ? allowed.includes(permission) : false;
};
