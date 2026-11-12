/**
 * Roles a person can choose when creating an account (guide section 8.1).
 * Which roles sign in during R&D and Pilot is open item 8; the Redesign Collective team
 * role is not self-assignable.
 */
export const ROLES = Object.freeze([
  Object.freeze({ id: 'designer', label: 'Architect or interior designer' }),
  Object.freeze({ id: 'project-manager', label: 'Construction project manager' }),
  Object.freeze({ id: 'procurement', label: 'Procurement professional' }),
  Object.freeze({ id: 'workroom', label: 'Workroom owner' }),
]);

export const ROLE_IDS = Object.freeze(ROLES.map((r) => r.id));
export const DEFAULT_ROLE = 'designer';

export function roleLabel(id) {
  return ROLES.find((r) => r.id === id)?.label || '';
}
