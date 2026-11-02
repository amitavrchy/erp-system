'use client';
import { useEffect, useState } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { Toaster } from 'sonner';
import { makeStore, preferences, session, activeOrg, type RootState, type Dispatch } from '@/store';
import { api, refreshSession } from '@/lib/api';
import type { Me } from '@/lib/types';

function Bootstrap({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<Dispatch>();
  const ui = useSelector((s: RootState) => s.ui);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ledgerflow-ui') ?? 'null');
      dispatch(
        preferences(
          saved
            ? {
                theme: saved.theme === 'light' ? 'light' : 'dark',
                density: saved.density === 'compact' ? 'compact' : 'comfortable',
                collapsed: saved.collapsed === true,
              }
            : { theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' },
        ),
      );
    } catch {
      dispatch(preferences({ theme: 'dark' }));
    }
    let live = true;
    refreshSession()
      .then(() => api.get<Me>('/me'))
      .then((r) => {
        if (live) {
          dispatch(session(r.data));
          dispatch(activeOrg(r.data.activeOrgId));
        }
      })
      .catch(() => {
        if (live) dispatch(session(null));
      });
    const expire = () => dispatch(session(null));
    window.addEventListener('session-expired', expire);
    return () => {
      live = false;
      window.removeEventListener('session-expired', expire);
    };
  }, [dispatch]);
  useEffect(() => {
    if (!ui.hydrated) return;
    document.documentElement.dataset.theme = ui.theme;
    document.documentElement.dataset.density = ui.density;
    try {
      localStorage.setItem('ledgerflow-ui', JSON.stringify(ui));
    } catch {
      /* Preferences are optional. */
    }
  }, [ui]);
  return (
    <>
      {children}
      <Toaster theme={ui.theme === 'light' ? 'light' : 'dark'} richColors position="bottom-right" />
    </>
  );
}
export function Providers({ children }: { children: React.ReactNode }) {
  const [store] = useState(makeStore);
  const [query] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: true } },
      }),
  );
  return (
    <Provider store={store}>
      <QueryClientProvider client={query}>
        <MotionConfig reducedMotion="user">
          <Bootstrap>{children}</Bootstrap>
        </MotionConfig>
      </QueryClientProvider>
    </Provider>
  );
}
