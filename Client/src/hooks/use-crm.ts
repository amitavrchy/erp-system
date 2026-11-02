'use client';
import { useQuery } from '@tanstack/react-query';
import { useWorkspace } from './use-workspace';
import { api } from '@/lib/api';
import type { CrmMeta, CrmPageData } from '@/lib/crm';
export function useCrmMeta(enabled = true) {
  const { orgId } = useWorkspace();
  return useQuery({
    queryKey: ['org', orgId, 'crm', 'meta'],
    queryFn: () => api.get<CrmMeta>('/crm/meta').then((r) => r.data),
    enabled: !!orgId && enabled,
  });
}
export function useCrmList(
  kind: string,
  params: Record<string, string | number> = {},
  enabled = true,
) {
  const { orgId } = useWorkspace();
  return useQuery({
    queryKey: ['org', orgId, 'crm', kind, params],
    queryFn: () => api.get<CrmPageData>(`/crm/${kind}`, { params }).then((r) => r.data),
    enabled: !!orgId && enabled,
  });
}
