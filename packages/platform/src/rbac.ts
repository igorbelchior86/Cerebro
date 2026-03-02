import type { CP0RbacRole } from '@cerebro/types';

export type RbacEnforcementPoint =
  | 'ticket.read'
  | 'ticket.write'
  | 'integration.write'
  | 'audit.read'
  | 'feature_flags.write';

const permissionMatrix: Record<RbacEnforcementPoint, CP0RbacRole[]> = {
  'ticket.read': ['admin', 'manager', 'tech', 'viewer'],
  'ticket.write': ['admin', 'manager', 'tech'],
  'integration.write': ['admin', 'manager', 'tech'],
  'audit.read': ['admin', 'manager'],
  'feature_flags.write': ['admin', 'manager'],
};

export function canRoleAccess(role: CP0RbacRole, point: RbacEnforcementPoint): boolean {
  return permissionMatrix[point].includes(role);
}

export function mapAuthRoleToP0Role(role?: string): CP0RbacRole {
  switch (role) {
    case 'owner':
    case 'admin':
      return 'admin';
    case 'member':
      return 'tech';
    default:
      return 'viewer';
  }
}
