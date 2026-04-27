import type { AttendeeRole } from './types';

export const ATTENDEE_ROLES: { value: AttendeeRole; label: string }[] = [
  { value: 'BACKEND_DEVELOPER', label: 'Backend Developer' },
  { value: 'FRONTEND_DEVELOPER', label: 'Frontend Developer' },
  { value: 'FULLSTACK_DEVELOPER', label: 'Fullstack Developer' },
  { value: 'PROJECT_MANAGER', label: 'Project Manager' },
  { value: 'PRODUCT_OWNER', label: 'Product Owner' },
  { value: 'CHIEF_TECHNOLOGY_OFFICER', label: 'Chief Technology Officer' },
  { value: 'HEAD_OF_ENGINEERING', label: 'Head of Engineering' },
  { value: 'ENGINEERING_MANAGER', label: 'Engineering Manager' },
  { value: 'DATABASE_ADMINISTRATOR', label: 'Database Administrator' },
  { value: 'DEVOPS', label: 'DevOps' },
  { value: 'DEVSECOPS', label: 'DevSecOps' },
  { value: 'NETWORK_ENGINEERING', label: 'Network Engineering' },
];

const labelMap = Object.fromEntries(ATTENDEE_ROLES.map((r) => [r.value, r.label])) as Record<
  AttendeeRole,
  string
>;

export function roleLabel(role: AttendeeRole | null | undefined): string {
  if (!role) return '—';
  return labelMap[role] ?? role;
}
