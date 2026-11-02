import { Suspense } from 'react';
import { Providers } from './providers';

export function SessionBoundary({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="loading-screen" role="status">
          Loading Ledgerflow…
        </div>
      }
    >
      <Providers>{children}</Providers>
    </Suspense>
  );
}
