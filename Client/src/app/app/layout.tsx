import { AppShell } from '@/components/app-shell';
import { SessionBoundary } from '@/components/session-boundary';
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SessionBoundary>
      <AppShell>{children}</AppShell>
    </SessionBoundary>
  );
}
