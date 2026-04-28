import { useQuery } from '@tanstack/react-query';

import { rolesApi } from './api';
import type { Role } from './types';

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
