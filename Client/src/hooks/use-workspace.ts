'use client';
import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import type { RootState } from '@/store';
import { api } from '@/lib/api';
import type { PageData } from '@/lib/types';
export function useWorkspace(){const user=useSelector((s:RootState)=>s.auth.user);const org=user?.memberships.find(m=>m.organization.id===user.activeOrgId)?.organization;return {user,org,orgId:user?.activeOrgId};}
export function useList(endpoint:string,params:Record<string,string|number>={},enabled=true){const {orgId}=useWorkspace();return useQuery({queryKey:['org',orgId,endpoint,params],queryFn:()=>api.get<PageData>(`/${endpoint}`,{params}).then(r=>r.data),enabled:!!orgId&&enabled});}
