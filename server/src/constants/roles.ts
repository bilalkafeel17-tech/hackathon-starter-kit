export const ROLES = ['admin', 'hr', 'employee'] as const;

export type Role = (typeof ROLES)[number];
