import { Suspense } from 'react';
export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="loading-screen" role="status">
          Loading invitation…
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
