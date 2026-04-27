import { useQuery } from '@tanstack/react-query';

import { rolesApi } from './api';
import type { Role } from './types';

/**
 * Shared React Query hook for the attendee-role dropdown.
 *
 * Kept lightweight: the backend returns only active roles already sorted,
 * so components just consume this list directly. Stale time is generous
 * because roles change rarely and a refetch isn't worth the jitter.
 */
export function useRoles() {
  return useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: rolesApi.list,
    staleTime: 5 * 60_000,
  });
}

export function roleLabel(role: Pick<Role, 'label' | 'code'> | null | undefined): string {
  if (!role) return '—';
  return role.label ?? role.code;
}
